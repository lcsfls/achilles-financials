import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SESSION_COOKIE, authEnabled, getUsername, verifySession } from "$lib/server/auth";


export async function GET({ cookies }: RequestEvent) {
  const authenticated = !authEnabled() || verifySession(cookies.get(SESSION_COOKIE));
  // This route is public: the username is half of the login, so only a
  // signed-in browser gets it.
  return json({ enabled: authEnabled(), username: authenticated ? getUsername() : null, authenticated });
}
