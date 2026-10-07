import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SESSION_COOKIE, authEnabled, getUsername, verifySession } from "$lib/server/auth";


export async function GET({ cookies }: RequestEvent) {
  return json({
    enabled: authEnabled(),
    username: getUsername(),
    authenticated: !authEnabled() || verifySession(cookies.get(SESSION_COOKIE)),
  });
}
