import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";


export async function GET() {
  const rows = db().prepare("SELECT * FROM investments ORDER BY units * COALESCE(current_price_eur, buy_price_eur) DESC").all();
  return json({ investments: rows });
}

export async function POST({ request: req }: RequestEvent) {
  const { name, symbol, units, buy_price_eur, current_price_eur, kind } = await req.json();
  if (!name || !(units > 0) || !(buy_price_eur > 0)) {
    return json({ error: "Name, Anzahl und Kaufpreis sind erforderlich" }, { status: 400 });
  }
  const result = db()
    .prepare("INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(name, symbol || null, units, buy_price_eur, current_price_eur ?? null, kind || "stock", new Date().toISOString());
  return json({ ok: true, id: result.lastInsertRowid });
}

export async function PATCH({ request: req }: RequestEvent) {
  const { id, current_price_eur, units, buy_price_eur } = await req.json();
  if (!id) return json({ error: "id erforderlich" }, { status: 400 });

  const sets: string[] = ["updated_at = ?"];
  const params: (string | number)[] = [new Date().toISOString()];
  if (current_price_eur != null) { sets.push("current_price_eur = ?"); params.push(current_price_eur); }
  if (units != null) { sets.push("units = ?"); params.push(units); }
  if (buy_price_eur != null) { sets.push("buy_price_eur = ?"); params.push(buy_price_eur); }
  params.push(id);

  db().prepare(`UPDATE investments SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return json({ ok: true });
}

export async function DELETE({ request: req }: RequestEvent) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM investments WHERE id = ?").run(Number(id));
  return json({ ok: true });
}
