import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SESSION_COOKIE, revokeSession } from "$lib/server/auth";

export async function POST({ cookies }: RequestEvent) {
  revokeSession(cookies.get(SESSION_COOKIE));
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return json({ ok: true });
}
