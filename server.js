/**
 * Production entry point — a small HTTP server around SvelteKit's adapter-node
 * handler.
 *
 * Kept as `server.js` on purpose: the Docker image, the systemd unit of the
 * .deb and existing installs all start `node server.js`, as they did under
 * Next.js, and read the same HOSTNAME/PORT variables.
 */
import http from "node:http";

// adapter-node caps request bodies at 512 KB; photos and backups need more.
// The routes enforce their own, tighter limits. Read when the handler loads.
process.env.BODY_SIZE_LIMIT ??= "64M";
// Take protocol and host from a reverse proxy when it sends them.
process.env.PROTOCOL_HEADER ??= "x-forwarded-proto";
process.env.HOST_HEADER ??= "x-forwarded-host";

const { handler } = await import("./build/handler.js");

const host = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  // adapter-node assumes https when no protocol header is present. This
  // server speaks plain http, so a request without a proxy in front *is*
  // http — say so, or the session cookie gets the Secure flag (and is then
  // never sent back over http) and uploads fail the same-origin check.
  if (!req.headers["x-forwarded-proto"]) req.headers["x-forwarded-proto"] = "http";
  handler(req, res);
});

server.listen(port, host, () => {
  console.log(`[achilles] listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Don't hang on keep-alive connections during a restart.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
