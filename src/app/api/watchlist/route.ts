import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQuote, getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

type Row = {
  id: number; symbol: string; label: string | null; added_at: string;
  price_at_add: number | null; price_eur_at_add: number | null; currency_at_add: string | null;
};

export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const rows = db().prepare("SELECT * FROM watchlist ORDER BY added_at").all() as Row[];
  const quotes = await getQuotes(rows.map((r) => r.symbol), force);

  return NextResponse.json({
    watchlist: rows.map((r) => {
      const quote = quotes.get(r.symbol) ?? null;

      // Zuwachs seit dem Hinzufügen — in EUR rechnen, wenn beide Seiten ihn
      // haben, sonst in der Notierungswährung. Sonst würde ein Währungs-
      // wechsel als Kursgewinn erscheinen.
      let since: { pct: number; abs: number; currency: string } | null = null;
      if (quote) {
        if (r.price_eur_at_add && quote.priceEur) {
          since = {
            pct: ((quote.priceEur - r.price_eur_at_add) / r.price_eur_at_add) * 100,
            abs: quote.priceEur - r.price_eur_at_add,
            currency: "EUR",
          };
        } else if (r.price_at_add && r.currency_at_add === quote.currency) {
          since = {
            pct: ((quote.price - r.price_at_add) / r.price_at_add) * 100,
            abs: quote.price - r.price_at_add,
            currency: quote.currency,
          };
        }
      }

      return {
        id: r.id,
        symbol: r.symbol,
        label: r.label,
        added_at: r.added_at,
        priceAtAdd: r.price_at_add,
        priceEurAtAdd: r.price_eur_at_add,
        currencyAtAdd: r.currency_at_add,
        quote,
        since,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { symbol, label } = await req.json();
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ error: "Symbol erforderlich" }, { status: 400 });

  const quote = await getQuote(sym, true);
  if (!quote) {
    return NextResponse.json({ error: `Kein Kurs für "${sym}" gefunden. Yahoo-Format verwenden, z. B. AAPL, VWCE.DE, IWDA.AS, BTC-EUR.` }, { status: 404 });
  }

  try {
    // Kurs beim Hinzufügen festhalten — er ist die Bezugsgröße für den Zuwachs
    // und später nicht mehr rekonstruierbar.
    db().prepare(
      "INSERT INTO watchlist (symbol, label, added_at, price_at_add, price_eur_at_add, currency_at_add) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(sym, label || quote.name, new Date().toISOString(), quote.price, quote.priceEur, quote.currency);
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
