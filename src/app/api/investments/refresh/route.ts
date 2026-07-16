import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

/** Aktualisiert current_price_eur aller Positionen, die ein Symbol haben, per Live-Kurs. */
export async function POST() {
  const d = db();
  const rows = d.prepare("SELECT id, symbol FROM investments WHERE symbol IS NOT NULL AND symbol != ''").all() as Array<{ id: number; symbol: string }>;
  if (rows.length === 0) return NextResponse.json({ ok: true, updated: 0, skipped: 0 });

  const quotes = await getQuotes([...new Set(rows.map((r) => r.symbol.toUpperCase()))], true);
  const update = d.prepare("UPDATE investments SET current_price_eur = ?, updated_at = ? WHERE id = ?");

  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const q = quotes.get(row.symbol.toUpperCase());
    if (q?.priceEur != null) {
      update.run(q.priceEur, now, row.id);
      updated++;
    } else {
      skipped++;
    }
  }
  return NextResponse.json({ ok: true, updated, skipped });
}
