import { NextRequest, NextResponse } from "next/server";
import { db, getSetting, setSetting } from "@/lib/db";
import { getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

type Row = { id: number; symbol: string; name: string | null; weight_pct: number };

/** Fondsaufteilung der Vorsorge inkl. Live-Kursen und Einzahlungshistorie. */
export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const d = db();
  const rows = d.prepare("SELECT * FROM pension_allocation ORDER BY weight_pct DESC, id").all() as Row[];

  const quotes = await getQuotes(rows.map((r) => r.symbol), refresh).catch(() => new Map());
  const latest = d
    .prepare("SELECT balance_eur FROM pension_statements ORDER BY statement_date DESC LIMIT 1")
    .get() as { balance_eur: number } | undefined;
  const balance = latest?.balance_eur ?? 0;

  const startDate = getSetting("pension_start_date");
  const monthly = Number(getSetting("pension_monthly") || 0);

  // Wie viel wurde seit Beginn eingezahlt? Nur eine Schätzung aus Startdatum ×
  // Monatsbeitrag — die echten Beiträge stehen ggf. in den Auszügen.
  let monthsSinceStart = 0;
  if (startDate) {
    const start = new Date(startDate);
    const now = new Date();
    monthsSinceStart = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  }
  const contributedEstimate = monthsSinceStart * monthly;

  const totalWeight = rows.reduce((s, r) => s + r.weight_pct, 0);

  return NextResponse.json({
    allocation: rows.map((r) => {
      const q = quotes.get(r.symbol);
      return {
        ...r,
        // Anteil am aktuellen Guthaben gemäß Gewichtung
        valueEur: balance > 0 ? (balance * r.weight_pct) / 100 : 0,
        quote: q ? { price: q.price, currency: q.currency, changePct: q.changePct, name: q.name, stale: q.stale } : null,
      };
    }),
    totalWeight,
    balance,
    startDate,
    monthly,
    monthsSinceStart,
    contributedEstimate,
    gainEstimate: startDate && monthly > 0 ? balance - contributedEstimate : null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.startDate !== undefined) {
    setSetting("pension_start_date", String(body.startDate));
    return NextResponse.json({ ok: true });
  }

  const { symbol, name, weight_pct } = body;
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ error: "Symbol erforderlich" }, { status: 400 });
  if (!(weight_pct > 0 && weight_pct <= 100)) {
    return NextResponse.json({ error: "Gewichtung muss zwischen 0 und 100 % liegen" }, { status: 400 });
  }

  // Symbol gegen die Kursquelle prüfen, damit keine Karteileiche entsteht
  const { getQuote } = await import("@/lib/quotes");
  let resolved = sym;
  let quote = await getQuote(sym, true);

  /*
   * An ISIN is what the fact sheet prints, so it is what people paste here —
   * but it is not a Yahoo ticker and carries no quote. Resolve it rather than
   * rejecting it and telling the user to go find the ticker themselves. Also
   * covers a plain fund name.
   */
  if (!quote) {
    const { searchInstruments, isIsin } = await import("@/lib/search");
    const hits = await searchInstruments(sym, 3).catch(() => []);
    for (const hit of hits) {
      const q = await getQuote(hit.symbol, true);
      if (q) { quote = q; resolved = hit.symbol; break; }
    }
    if (!quote) {
      return NextResponse.json(
        {
          error: isIsin(sym)
            ? `Zu der ISIN "${sym}" ließ sich kein handelbares Kürzel mit Kursdaten finden.`
            : `Kein Kurs für "${sym}" gefunden. Suche nach Name oder ISIN und wähle einen Treffer aus.`,
        },
        { status: 404 }
      );
    }
  }

  const d = db();
  const existing = (d.prepare("SELECT COALESCE(SUM(weight_pct), 0) AS w FROM pension_allocation").get() as { w: number }).w;
  if (existing + weight_pct > 100.01) {
    return NextResponse.json(
      { error: `Gesamtgewichtung würde ${(existing + weight_pct).toFixed(1)} % ergeben. Verfügbar sind noch ${(100 - existing).toFixed(1)} %.` },
      { status: 400 }
    );
  }

  d.prepare("INSERT INTO pension_allocation (symbol, name, weight_pct) VALUES (?, ?, ?)")
    .run(resolved, name || quote.name, weight_pct);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, weight_pct } = await req.json();
  if (!id || !(weight_pct > 0 && weight_pct <= 100)) {
    return NextResponse.json({ error: "id und gültige Gewichtung erforderlich" }, { status: 400 });
  }
  const d = db();
  const others = (d.prepare("SELECT COALESCE(SUM(weight_pct), 0) AS w FROM pension_allocation WHERE id != ?").get(id) as { w: number }).w;
  if (others + weight_pct > 100.01) {
    return NextResponse.json({ error: `Verfügbar sind noch ${(100 - others).toFixed(1)} %.` }, { status: 400 });
  }
  d.prepare("UPDATE pension_allocation SET weight_pct = ? WHERE id = ?").run(weight_pct, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM pension_allocation WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
