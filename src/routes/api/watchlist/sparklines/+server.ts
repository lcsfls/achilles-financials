import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { getHistory } from "$lib/server/quotes";

/**
 * Six-month closes for every watchlist symbol, in one request.
 *
 * One call instead of one per tile: the browser would otherwise queue a dozen
 * requests behind its connection limit. Stored curves are returned as they
 * are and refreshed in the background once expired — a sparkline from this
 * morning is fine, a tile waiting for Yahoo is not.
 */
export async function GET() {
  const symbols = (db().prepare("SELECT symbol FROM watchlist").all() as Array<{ symbol: string }>).map((r) => r.symbol);
  const out: Record<string, number[]> = {};
  const queue = [...symbols];
  const worker = async () => {
    for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
      const points = await getHistory(s, "6mo", { cacheFirst: true });
      if (points) out[s] = points.map((p) => p.c);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, worker));
  return json({ sparklines: out });
}
