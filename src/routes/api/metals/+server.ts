import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { getMetalHoldings, getSpotPrices, METALS } from "$lib/server/metals";


export async function GET({ request: req }: RequestEvent) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (force) await getSpotPrices(true).catch(() => null);
  const data = await getMetalHoldings();
  return json(data);
}

export async function POST({ request: req }: RequestEvent) {
  const body = await req.json();
  const { metal, grams, purchase_price_eur, purchase_date, vendor, note } = body;

  if (!METALS[metal]) return json({ error: "Unbekanntes Metall" }, { status: 400 });
  if (!(grams > 0) || !(purchase_price_eur > 0) || !purchase_date) {
    return json({ error: "Gramm, Kaufpreis und Datum sind erforderlich" }, { status: 400 });
  }

  const result = db()
    .prepare("INSERT INTO metal_lots (metal, grams, purchase_price_eur, purchase_date, vendor, note) VALUES (?, ?, ?, ?, ?, ?)")
    .run(metal, grams, purchase_price_eur, purchase_date, vendor || null, note || null);

  return json({ ok: true, id: result.lastInsertRowid });
}

export async function DELETE({ request: req }: RequestEvent) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM metal_lots WHERE id = ?").run(Number(id));
  return json({ ok: true });
}
