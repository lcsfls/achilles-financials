import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getHistory, isRange } from "$lib/server/quotes";


/** Kursverlauf für den Hover-Chart der Watchlist. */
export async function GET({ request: req }: RequestEvent) {
  const params = new URL(req.url).searchParams;
  const symbol = params.get("symbol");
  const raw = params.get("range") ?? "6mo";
  const range = isRange(raw) ? raw : "6mo";
  if (!symbol) return json({ error: "symbol erforderlich" }, { status: 400 });

  const data = await getHistory(symbol, range);
  if (!data) return json({ error: "Kein Verlauf verfügbar" }, { status: 404 });
  return json({ symbol, range, points: data });
}
