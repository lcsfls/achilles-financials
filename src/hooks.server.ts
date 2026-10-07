import { json, type Handle, type ServerInit } from "@sveltejs/kit";
import { SESSION_COOKIE, authEnabled, verifySession } from "$lib/server/auth";
import { getSetting } from "$lib/server/db";
import { applyLang } from "$lib/prefs.svelte";

/**
 * Server start-up — registers the background sync timer.
 *
 * The timer only *checks* every 15 minutes whether a run is due; the actual
 * interval comes from the setting and is floored at 6 hours (PSD2 permits four
 * unattended accesses per day). Checking often but acting rarely keeps the
 * schedule accurate after a container restart without ever calling the bank
 * more than allowed.
 */
export const init: ServerInit = async () => {
  const { isDue, markAutoSync } = await import("$lib/server/autosync");
  const { syncAccounts } = await import("$lib/server/enablebanking");

  const CHECK_EVERY = 15 * 60_000;

  const tick = async () => {
    try {
      if (!isDue()) return;
      // Stamp *before* syncing: a failing bank must not retry every 15 minutes.
      markAutoSync();
      const r = await syncAccounts();
      console.log(`[achilles] auto-sync: ${r.accounts} accounts, ${r.transactions} transactions`);
    } catch (e) {
      console.warn("[achilles] auto-sync failed:", e instanceof Error ? e.message : e);
    }
  };

  // Not immediately on boot — let the app finish starting first.
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, CHECK_EVERY).unref?.();
};

/**
 * Paths that stay reachable with a login enabled. The PWA assets must: the
 * browser fetches the manifest before (and on) the login page. Files under
 * static/ (sw.js, icons, theme.js) are served before this hook runs and need
 * no entry here.
 */
function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_app/") ||
    pathname === "/manifest.webmanifest"
  );
}

const SECURITY_HEADERS: Record<string, string> = {
  // No embedding in foreign pages. Otherwise a page could overlay Achilles
  // invisibly and capture clicks — for an app that can run in the LAN without
  // a login, not a theoretical concern.
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  // Don't pass our own address on to foreign sites — it reveals the internal hostname.
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/**
 * Central guard instead of a check per route — a forgotten route is exactly
 * the gap otherwise.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // As long as no login is set up, everything stays open — otherwise you could
  // lock yourself out right after the first start.
  if (authEnabled() && !isPublic(pathname) && !verifySession(event.cookies.get(SESSION_COOKIE))) {
    if (pathname.startsWith("/api/")) return json({ error: "Nicht angemeldet" }, { status: 401 });
    return new Response(null, { status: 303, headers: { location: "/login" } });
  }

  const lang = getSetting("language") === "en" ? "en" : "de";
  // Server-side render in the configured language. prefs is module state and
  // thus shared across requests — fine here: language is one global setting.
  applyLang(lang);
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", lang),
  });
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
};
