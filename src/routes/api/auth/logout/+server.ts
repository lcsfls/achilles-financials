import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SESSION_COOKIE } from "$lib/server/auth";

export async function POST({ cookies }: RequestEvent) {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return json({ ok: true });
}
