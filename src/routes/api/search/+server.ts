import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { searchInstruments } from "$lib/search";


export async function GET({ request: req }: RequestEvent) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return json({ hits: [] });
  try {
    return json({ hits: await searchInstruments(q) });
  } catch (e) {
    return json({ error: (e as Error).message, hits: [] }, { status: 502 });
  }
}
