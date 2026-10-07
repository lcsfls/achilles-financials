import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { listRecurring, setIgnored } from "$lib/server/recurring";

export async function GET() {
  return json(listRecurring());
}

/** Mark a detected payee as "not a subscription" (or undo): { key, ignored }. */
export async function POST({ request }: RequestEvent) {
  const { key, ignored } = await request.json();
  if (!key || typeof key !== "string") return json({ error: "key erforderlich" }, { status: 400 });
  setIgnored(key, ignored !== false);
  return json({ ok: true });
}
