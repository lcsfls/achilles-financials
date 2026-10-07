import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: "build" }),
    // Bank-callback and settings forms post JSON via fetch, not HTML forms —
    // the CSRF check stays on for real form posts.
    csp: {
      mode: "auto",
      directives: {
        "default-src": ["self"],
        // SvelteKit hashes its own inline bootstrap script — no 'unsafe-inline'
        // for scripts any more, which Next.js needed for hydration.
        "script-src": ["self"],
        "style-src": ["self", "unsafe-inline"],
        // Bank logos come from Enable Banking, data/blob URLs from photo previews.
        "img-src": ["self", "data:", "blob:", "https:"],
        "font-src": ["self", "data:"],
        // Quotes and bank calls run server-side; the browser only talks to the app.
        "connect-src": ["self"],
        "worker-src": ["self"],
        "manifest-src": ["self"],
        "frame-ancestors": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
      },
    },
  },
};

export default config;
