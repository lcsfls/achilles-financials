import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db().prepare("SELECT * FROM investments ORDER BY units * COALESCE(current_price_eur, buy_price_eur) DESC").all();
  return NextResponse.json({ investments: rows });
}

export async function POST(req: NextRequest) {
  const { name, symbol, units, buy_price_eur, current_price_eur, kind } = await req.json();
  if (!name || !(units > 0) || !(buy_price_eur > 0)) {
    return NextResponse.json({ error: "Name, Anzahl und Kaufpreis sind erforderlich" }, { status: 400 });
  }
  const result = db()
    .prepare("INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(name, symbol || null, units, buy_price_eur, current_price_eur ?? null, kind || "stock", new Date().toISOString());
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const { id, current_price_eur, units, buy_price_eur } = await req.json();
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const sets: string[] = ["updated_at = ?"];
  const params: (string | number)[] = [new Date().toISOString()];
  if (current_price_eur != null) { sets.push("current_price_eur = ?"); params.push(current_price_eur); }
  if (units != null) { sets.push("units = ?"); params.push(units); }
  if (buy_price_eur != null) { sets.push("buy_price_eur = ?"); params.push(buy_price_eur); }
  params.push(id);

  db().prepare(`UPDATE investments SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM investments WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
