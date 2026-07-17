/*
 * Achilles service worker — installability plus a fast repeat load, without
 * ever risking stale financial data.
 *
 * The rules matter for a money app:
 *   - /api/*        network only. A cached balance shown offline would be a lie.
 *   - /_next/static hashed and immutable → cache first, forever.
 *   - navigations   network first, fall back to the last cached shell, then to
 *                   a small offline notice. Never a stale API response.
 */
const VERSION = "achilles-v1";
const STATIC = `${VERSION}-static`;
const SHELL = `${VERSION}-shell`;

const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline</title><style>html{background:#07080c;color:#e5e7eb;font-family:system-ui,sans-serif;' +
  "height:100%}body{height:100%;margin:0;display:grid;place-items:center;text-align:center;padding:2rem}" +
  "b{color:#e9cd6f;font-size:1.1rem}p{color:#9ca3af;max-width:22rem}</style>" +
  "<div><b>Achilles is offline</b><p>No connection to your server right now. Reconnect and reload — " +
  "your data lives on the server, nothing was lost.</p></div>";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth traffic — always the live server.
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build assets: cache first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // Page navigations: network first, cache the shell, fall back when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (hit) => hit || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
          )
        )
    );
  }
});
