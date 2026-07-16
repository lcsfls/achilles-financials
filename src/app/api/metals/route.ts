import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMetalHoldings, getSpotPrices, METALS } from "@/lib/metals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (force) await getSpotPrices(true).catch(() => null);
  const data = await getMetalHoldings();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { metal, grams, purchase_price_eur, purchase_date, vendor, note } = body;

  if (!METALS[metal]) return NextResponse.json({ error: "Unbekanntes Metall" }, { status: 400 });
  if (!(grams > 0) || !(purchase_price_eur > 0) || !purchase_date) {
    return NextResponse.json({ error: "Gramm, Kaufpreis und Datum sind erforderlich" }, { status: 400 });
  }

  const result = db()
    .prepare("INSERT INTO metal_lots (metal, grams, purchase_price_eur, purchase_date, vendor, note) VALUES (?, ?, ?, ?, ?, ?)")
    .run(metal, grams, purchase_price_eur, purchase_date, vendor || null, note || null);

  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM metal_lots WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
