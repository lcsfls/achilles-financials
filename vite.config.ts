import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Version from package.json baked into the build — so the app knows its
  // version even without the control channel (plain Docker without bind mount).
  define: { "process.env.APP_VERSION": JSON.stringify(pkg.version) },
  ssr: { external: ["better-sqlite3", "fints-lib"] },
});
