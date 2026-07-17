import { db } from "./db";
import { ratesFromEur } from "./currency";

/**
 * Positionen aus einer externen Quelle ins Depot übernehmen.
 *
 * Gemeinsam genutzt vom CSV-Import und vom FinTS-Depotabruf: Beide liefern
 * dieselbe Art von Daten und brauchen dieselben Entscheidungen (Umrechnung,
 * Zusammenführen, Kursfähigkeit). Zweimal gepflegt würden sie auseinanderlaufen.
 */

export type IncomingPosition = {
  name: string;
  symbol: string | null;
  units: number;
  /** null = Einstand unbekannt (kommt bei FinTS vor). Wird dann nicht erfunden. */
  buyPricePerUnit: number | null;
  currentPrice: number | null;
  currency: string;
  kind: "stock" | "etf" | "crypto" | "other";
};

export type UpsertResult = {
  inserted: number;
  updated: number;
  /** Neu angelegt mit einer Kennung, die Yahoo nicht kennt — kein Kursabruf möglich. */
  noQuoteSymbols: string[];
  /** Neu angelegt ohne Einstandskurs — die Wertentwicklung stimmt dort noch nicht. */
  withoutCostBasis: string[];
  /** Währungen, die zum heutigen Kurs umgerechnet wurden. */
  convertedFrom: string[];
};

/**
 * WKN oder ISIN — beide sehen aus wie ein Symbol, taugen aber nicht für den
 * Kursabruf, weil Yahoo nur Kürzel kennt.
 *
 * WKN sind sechs alphanumerische Zeichen mit mindestens einer Ziffer
 * ("865985", "A1JX52") — reine Buchstabenfolgen bleiben außen vor, die wären
 * eher ein Kürzel. Yahoo-Kürzel dieser Länge tragen immer einen Punkt oder
 * Bindestrich ("VWCE.DE", "BTC-EUR") und fallen damit ohnehin nicht darunter.
 */
export const NO_QUOTE = /^(?=.*\d)[A-Z0-9]{6}$|^[A-Z]{2}[A-Z0-9]{9}\d$/i;

/** Anlageart raten — nur eine Vorbelegung, in der Oberfläche änderbar. */
export function guessKind(name: string, symbol: string | null): IncomingPosition["kind"] {
  const s = `${name} ${symbol ?? ""}`.toLowerCase();
  if (/\b(btc|eth|xrp|sol|ada|doge|bitcoin|ethereum)\b/.test(s) || /-(eur|usd)$/i.test(symbol ?? "")) return "crypto";
  if (/\betf\b|ucits|index|msci|s&p|ftse/.test(s)) return "etf";
  return "stock";
}

export class PositionError extends Error {}

export async function upsertPositions(
  positions: IncomingPosition[],
  source: "csv" | "fints"
): Promise<UpsertResult> {
  // Beträge werden in EUR geführt. Fremdwährungen lassen sich nur mit dem
  // heutigen Kurs umrechnen — eine Quelle liefert keinen historischen. Für den
  // aktuellen Kurs stimmt das, für den Einstand eines alten Kaufs nicht: die
  // Oberfläche muss das sagen dürfen, deshalb wird es zurückgemeldet.
  const foreign = [...new Set(positions.map((p) => p.currency))].filter((c) => c !== "EUR");
  let rates: Record<string, number> = { EUR: 1 };
  if (foreign.length > 0) {
    rates = await ratesFromEur();
    const unknown = foreign.filter((c) => !rates[c]);
    if (unknown.length > 0) {
      throw new PositionError(`Für ${unknown.join(", ")} liegt kein Wechselkurs vor.`);
    }
  }
  const toEur = (v: number, cur: string) => (cur === "EUR" ? v : v / rates[cur]);

  const d = db();
  const now = new Date().toISOString();

  return d.transaction(() => {
    const findBySymbol = d.prepare("SELECT id FROM investments WHERE symbol IS NOT NULL AND UPPER(symbol) = UPPER(?)");
    // Rückfallebene über den Namen: Deutsche Quellen liefern WKN oder ISIN,
    // vorhandene Positionen tragen oft das Yahoo-Kürzel. "865985" und "AAPL"
    // sind dieselbe Aktie — ohne diesen Abgleich stünde Apple zweimal im
    // Depot und zählte doppelt ins Gesamtvermögen.
    const findByName = d.prepare("SELECT id FROM investments WHERE UPPER(name) = UPPER(?)");
    const update = d.prepare(
      // COALESCE auf den Einstand: Ist er unbekannt oder hat ihn jemand von
      // Hand gepflegt, darf ihn ein Abruf nicht überschreiben.
      `UPDATE investments SET name = ?, units = ?,
         buy_price_eur = COALESCE(?, buy_price_eur),
         current_price_eur = COALESCE(?, current_price_eur),
         kind = ?, updated_at = ?, source = ?, demo = 0
       WHERE id = ?`
    );
    const insert = d.prepare(
      `INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at, source, demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    );

    let inserted = 0;
    let updated = 0;
    // Erst beim Schreiben feststellbar: Eine zusammengeführte Position behält
    // ihr vorhandenes Kürzel und ihren Einstand — aus der Quelle gelesen würde
    // hier fälschlich gewarnt.
    const noQuoteSymbols: string[] = [];
    const withoutCostBasis: string[] = [];

    for (const p of positions) {
      const buy = p.buyPricePerUnit === null ? null : toEur(p.buyPricePerUnit, p.currency);
      const cur = p.currentPrice === null ? null : toEur(p.currentPrice, p.currency);
      const existing = ((p.symbol ? findBySymbol.get(p.symbol) : undefined) ?? findByName.get(p.name)) as
        | { id: number }
        | undefined;

      if (existing) {
        update.run(p.name, p.units, buy, cur, p.kind, now, source, existing.id);
        updated++;
      } else {
        // Ohne Einstand als Platzhalter den aktuellen Kurs setzen — die Spalte
        // lässt kein NULL zu. Das ergibt vorerst 0 % Entwicklung, was nicht
        // stimmt, deshalb wird die Position gemeldet statt es zu verschweigen.
        insert.run(p.name, p.symbol, p.units, buy ?? cur ?? 0, cur, p.kind, now, source);
        inserted++;
        if (buy === null) withoutCostBasis.push(p.name);
        if (p.symbol && NO_QUOTE.test(p.symbol)) noQuoteSymbols.push(p.symbol);
      }
    }
    return { inserted, updated, noQuoteSymbols, withoutCostBasis, convertedFrom: foreign };
  })();
}
