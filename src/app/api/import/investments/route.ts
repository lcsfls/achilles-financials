import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CsvError, parsePositionsCsv } from "@/lib/csv";
import { ratesFromEur } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * WKN oder ISIN — beide sehen aus wie ein Symbol, taugen aber nicht für den
 * Kursabruf, weil Yahoo nur Kürzel kennt.
 *
 * WKN sind sechs alphanumerische Zeichen mit mindestens einer Ziffer
 * ("865985", "A1JX52") — reine Buchstabenfolgen bleiben außen vor, die wären
 * eher ein Kürzel. Yahoo-Kürzel dieser Länge tragen immer einen Punkt oder
 * Bindestrich ("VWCE.DE", "BTC-EUR") und fallen damit ohnehin nicht darunter.
 */
const NO_QUOTE = /^(?=.*\d)[A-Z0-9]{6}$|^[A-Z]{2}[A-Z0-9]{9}\d$/i;

/**
 * Import eines Depot-Exports (Bestand oder Orderliste).
 * Das Format wird erkannt, nicht vorausgesetzt — siehe src/lib/csv.ts.
 */
export async function POST(req: NextRequest) {
  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "CSV-Inhalt fehlt" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parsePositionsCsv(csv);
  } catch (e) {
    const msg = e instanceof CsvError ? e.message : "Die Datei konnte nicht gelesen werden.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Beträge werden in EUR geführt. Fremdwährungen lassen sich nur mit dem
  // heutigen Kurs umrechnen — im Export steht kein historischer. Für den
  // aktuellen Kurs stimmt das, für den Einstand eines alten Kaufs nicht: die
  // Oberfläche muss das sagen dürfen, deshalb wird es zurückgemeldet.
  const foreign = parsed.currencies.filter((c) => c !== "EUR");
  let rates: Record<string, number> = { EUR: 1 };
  if (foreign.length > 0) {
    rates = await ratesFromEur();
    const unknown = foreign.filter((c) => !rates[c]);
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Für ${unknown.join(", ")} liegt kein Wechselkurs vor. Bitte einen Export in EUR verwenden.` },
        { status: 400 }
      );
    }
  }
  const toEur = (v: number, cur: string) => (cur === "EUR" ? v : v / rates[cur]);

  const d = db();
  const now = new Date().toISOString();

  const result = d.transaction(() => {
    // Gleiche Position nicht doppelt anlegen: ein zweiter Import desselben
    // Depots soll aktualisieren, nicht verdoppeln.
    const findBySymbol = d.prepare("SELECT id FROM investments WHERE symbol IS NOT NULL AND UPPER(symbol) = UPPER(?)");
    // Rückfallebene über den Namen: Deutsche Exporte liefern WKN oder ISIN,
    // vorhandene Positionen tragen oft das Yahoo-Kürzel. "865985" und "AAPL"
    // sind dieselbe Aktie — ohne diesen Abgleich stünde Apple zweimal im
    // Depot und zählte doppelt ins Gesamtvermögen.
    const findByName = d.prepare("SELECT id FROM investments WHERE UPPER(name) = UPPER(?)");
    const update = d.prepare(
      `UPDATE investments SET name = ?, units = ?, buy_price_eur = ?,
         current_price_eur = COALESCE(?, current_price_eur), kind = ?, updated_at = ?, source = 'csv', demo = 0
       WHERE id = ?`
    );
    const insert = d.prepare(
      `INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at, source, demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'csv', 0)`
    );

    let inserted = 0;
    let updated = 0;
    // Erst beim Schreiben feststellbar: Eine zusammengeführte Position behält
    // ihr vorhandenes Kürzel, die WKN aus der Datei landet gar nicht in der
    // Datenbank. Aus der CSV gelesen würde hier fälschlich gewarnt.
    const noQuoteSymbols: string[] = [];
    for (const p of parsed.positions) {
      const buy = toEur(p.buyPricePerUnit, p.currency);
      const cur = p.currentPrice === null ? null : toEur(p.currentPrice, p.currency);
      const existing = ((p.symbol ? findBySymbol.get(p.symbol) : undefined) ?? findByName.get(p.name)) as
        | { id: number }
        | undefined;
      if (existing) {
        update.run(p.name, p.units, buy, cur, p.kind, now, existing.id);
        updated++;
      } else {
        insert.run(p.name, p.symbol, p.units, buy, cur, p.kind, now);
        inserted++;
        if (p.symbol && NO_QUOTE.test(p.symbol)) noQuoteSymbols.push(p.symbol);
      }
    }
    return { inserted, updated, noQuoteSymbols };
  })();

  return NextResponse.json({
    ...result,
    skipped: parsed.skipped,
    mode: parsed.mode,
    // Damit ein unbekannter Export überprüfbar ist, statt ihm glauben zu müssen
    detected: { delimiter: parsed.delimiter, headerRow: parsed.headerRow, mapping: parsed.mapping },
    convertedFrom: foreign,
  });
}
