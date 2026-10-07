import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { computeCashflow } from "$lib/server/cashflow";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cash flow for a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). */
export async function GET({ url }: RequestEvent) {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) {
    return json({ error: "Zeitraum ungültig — erwartet from und to als JJJJ-MM-TT." }, { status: 400 });
  }
  const pf = url.searchParams.get("prevFrom") ?? "";
  const pt = url.searchParams.get("prevTo") ?? "";
  const prev = DATE.test(pf) && DATE.test(pt) && pf <= pt ? { from: pf, to: pt } : undefined;
  return json(computeCashflow(from, to, prev));
}
