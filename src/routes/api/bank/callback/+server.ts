import type { RequestEvent } from "@sveltejs/kit";
import { setSetting } from "$lib/server/db";
import { completeAuth } from "$lib/server/enablebanking";
import { publicOrigin } from "$lib/server/app-url";


/**
 * Redirect-Ziel nach der Autorisierung in der Banking-App.
 * Anders als bei GoCardless muss die Session hier selbst eingelöst werden:
 * der `code` aus der Query wird gegen eine Session getauscht.
 */
export async function GET({ request: req }: RequestEvent) {
  const url = new URL(req.url);
  const origin = publicOrigin(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? undefined;
  const error = url.searchParams.get("error");

  if (error || !code) {
    setSetting("eb_auth_status", "error");
    return redirectTo(`${origin}/connect?error=${encodeURIComponent(error || "no_code")}`);
  }

  try {
    await completeAuth(code, state);
    return redirectTo(`${origin}/connect?linked=1`);
  } catch (e) {
    setSetting("eb_auth_status", "error");
    return redirectTo(`${origin}/connect?error=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
}

function redirectTo(location: string) {
  return new Response(null, { status: 307, headers: { location } });
}
