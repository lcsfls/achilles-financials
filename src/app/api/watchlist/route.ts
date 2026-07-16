import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const rows = db().prepare("SELECT * FROM watchlist ORDER BY added_at").all() as Array<{ id: number; symbol: string; label: string | null; added_at: string }>;
  const quotes = await getQuotes(rows.map((r) => r.symbol), force);
  return NextResponse.json({
    watchlist: rows.map((r) => ({ ...r, quote: quotes.get(r.symbol) ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const { symbol, label } = await req.json();
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ error: "Symbol erforderlich" }, { status: 400 });

  // Symbol validieren, indem wir direkt einen Kurs holen
  const { getQuote } = await import("@/lib/quotes");
  const quote = await getQuote(sym, true);
  if (!quote) {
    return NextResponse.json({ error: `Kein Kurs für "${sym}" gefunden. Yahoo-Format verwenden, z. B. AAPL, VWCE.DE, IWDA.AS, BTC-EUR.` }, { status: 404 });
  }

  try {
    db().prepare("INSERT INTO watchlist (symbol, label, added_at) VALUES (?, ?, ?)").run(sym, label || quote.name, new Date().toISOString());
  } catch {
    return NextResponse.json({ error: "Symbol ist bereits auf der Watchlist" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, quote });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM watchlist WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
