import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQuote, getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

type Row = {
  id: number; symbol: string; label: string | null; added_at: string;
  price_at_add: number | null; price_eur_at_add: number | null; currency_at_add: string | null;
  pinned: number;
  sort_order: number;
};

export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  // Angepinnte zuerst — die Reihenfolge kommt aus der Datenbank, damit sie
  // auf jedem Gerät gleich ist und nicht erst im Browser entsteht.
  const rows = db().prepare("SELECT * FROM watchlist ORDER BY pinned DESC, sort_order, added_at").all() as Row[];
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
        pinned: r.pinned === 1,
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
    // Ans Ende einsortieren — ein neuer Wert soll die selbst gelegte
    // Reihenfolge nicht durcheinanderbringen.
    db().prepare(
      `INSERT INTO watchlist (symbol, label, added_at, price_at_add, price_eur_at_add, currency_at_add, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM watchlist))`
    ).run(sym, label || quote.name, new Date().toISOString(), quote.price, quote.priceEur, quote.currency);
  } catch {
    return NextResponse.json({ error: "Symbol ist bereits auf der Watchlist" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, quote });
}

/** Anpinnen / lösen — oder die Reihenfolge neu setzen. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();

  // Ganze Reihenfolge statt einzelner Positionen: Nach einem Tausch sind immer
  // zwei Kacheln betroffen, und die Liste als Ganzes zu schreiben kann nicht
  // halb misslingen.
  if (Array.isArray(body.order)) {
    const set = db().prepare("UPDATE watchlist SET sort_order = ? WHERE id = ?");
    db().transaction((ids: number[]) => ids.forEach((id, i) => set.run(i + 1, id)))(body.order);
    return NextResponse.json({ ok: true });
  }

  const { id, pinned } = body;
  if (typeof id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("UPDATE watchlist SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM watchlist WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
