import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { getSetting } from "$lib/server/db";
import { authEnabled } from "$lib/server/auth";

/**
 * First-run guard and the language for server rendering.
 *
 * Runs on the server, so a fresh install lands in the wizard before a single
 * byte of the dashboard renders — no client-side redirect flicker. The login
 * page is exempt: whoever logs in has finished setup already, and the hook has
 * sent anyone unauthenticated there.
 */
export const load: LayoutServerLoad = ({ url }) => {
  const setupDone = getSetting("setup_done") === "1";
  const path = url.pathname;
  if (!setupDone && path !== "/setup" && path !== "/login") redirect(303, "/setup");
  return {
    lang: (getSetting("language") === "en" ? "en" : "de") as "de" | "en",
    authEnabled: authEnabled(),
  };
};
