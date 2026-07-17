/**
 * Kontoauszüge aus beliebigen CSV-Exporten lesen.
 *
 * Es gibt keinen Standard: Revolut liefert Komma, ISO-Datum und englische
 * Spalten; Sparkasse und Volksbank Semikolon, DD.MM.YYYY, deutsche Zahlen und
 * teils getrennte Soll/Haben-Spalten. Statt ein Format zu erzwingen, wird
 * jedes Merkmal aus den Daten erkannt.
 */

export type ParsedRow = {
  date: string;          // ISO
  amount: number;        // mit Vorzeichen
  currency: string | null;
  merchant: string | null;
  description: string | null;
  balance: number | null;
  pending: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  skipped: number;
  delimiter: string;
  headerRow: number;
  mapping: Record<string, string>;
};

export class CsvError extends Error {}

/* ---------- Zerlegen ---------- */

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Trennzeichen raten: das, welches über die ersten Zeilen am gleichmäßigsten viele Felder ergibt. */
function detectDelimiter(lines: string[]): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestScore = -1;

  for (const d of candidates) {
    const counts = lines.slice(0, 10).map((l) => splitLine(l, d).length);
    const max = Math.max(...counts);
    if (max < 2) continue;
    // Gleichmäßigkeit zählt: ein falsches Trennzeichen ergibt schwankende Feldzahlen
    const consistent = counts.filter((c) => c === max).length;
    const score = max * consistent;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/* ---------- Spalten erkennen ---------- */

const ALIASES: Record<string, string[]> = {
  // Reihenfolge = Priorität: das tatsächliche Buchungsdatum vor Valuta und
  // vor dem Anstoßdatum ("Started Date" ist bei Revolut nicht die Buchung).
  date: ["buchungstag", "completed date", "abschlussdatum", "booking date", "buchungsdatum", "valutadatum", "valuta", "wertstellung", "transaction date", "datum", "date", "started date", "startdatum"],
  amount: ["betrag", "umsatz", "amount", "betrag (eur)", "betrag eur", "wert"],
  debit: ["soll", "belastung", "ausgang", "debit", "auszahlung"],
  credit: ["haben", "gutschrift", "eingang", "credit", "einzahlung"],
  sign: ["soll/haben", "soll/haben-kennzeichen", "s/h", "vorzeichen", "credit_debit_indicator"],
  currency: ["währung", "waehrung", "currency", "wkz", "betrag-währung"],
  merchant: ["auftraggeber/empfänger", "auftraggeber / empfänger", "empfänger", "beguenstigter", "begünstigter", "zahlungsempfänger", "name", "payee", "merchant", "counterparty", "beguenstigter/zahlungspflichtiger"],
  description: ["verwendungszweck", "remittance information", "beschreibung", "description", "vwz", "referenz", "reference", "buchungstext", "umsatzart"],
  balance: ["saldo", "kontostand", "balance", "saldo nach buchung"],
  state: ["status", "state", "zustand"],
};

/**
 * Depot-Exporte kennen andere Spalten als Kontoauszüge — und teils dieselben
 * Wörter mit anderer Bedeutung ("Betrag" ist hier der Kurswert, nicht die
 * Buchung). Deshalb ein eigener Satz statt Erweiterung von ALIASES.
 */
const POS_ALIASES: Record<string, string[]> = {
  symbol: ["symbol", "ticker", "kürzel", "isin", "wkn"],
  secname: ["bezeichnung", "wertpapiername", "wertpapier", "instrument", "produkt", "security", "name"],
  units: ["anzahl", "stückzahl", "stück", "stk", "quantity", "qty", "shares", "menge", "nominale", "nominal", "units"],
  // Einstandskurs vor allgemeinem "Kurs": In Bestandslisten stehen oft beide.
  price: ["einstandskurs", "einstandspreis", "kaufkurs", "durchschnittskurs", "average price", "avg price", "buy price", "purchase price", "kurs", "preis", "price"],
  curprice: ["aktueller kurs", "current price", "market price", "letzter kurs", "last price", "schlusskurs"],
  total: ["einstandswert", "kaufwert", "cost basis", "marktwert", "market value", "gesamtwert", "kurswert", "value", "wert", "betrag", "amount"],
  action: ["transaktionstyp", "order type", "buy/sell", "richtung", "typ", "type", "action", "art", "side", "seite"],
  fee: ["gebühren", "gebühr", "gebuehren", "provision", "fees", "fee", "commission"],
  currency: ["währung", "waehrung", "currency", "wkz"],
  date: ["ausführungstag", "handelstag", "buchungstag", "trade date", "datum", "date"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/^﻿/, "").replace(/["']/g, "").trim();
}

/**
 * Die Alias-Reihenfolge ist die Priorität, deshalb außen iterieren: Sonst
 * gewinnt die Spalte, die zufällig weiter links steht — Revolut lieferte so
 * "Started Date" statt "Completed Date", die Sparkasse "Buchungstext" statt
 * "Verwendungszweck".
 */
function matchColumn(
  header: string[],
  key: string,
  exclude: number[] = [],
  map: Record<string, string[]> = ALIASES
): number {
  const names = map[key];
  // Erst exakt über alle Spalten, dann als Teilstring — sonst greift "datum"
  // bereits bei "Wertstellungsdatum", bevor "buchungstag" geprüft wurde.
  for (const exact of [true, false]) {
    for (const n of names) {
      for (let i = 0; i < header.length; i++) {
        if (exclude.includes(i)) continue;
        const h = normalize(header[i]);
        if (!h) continue;
        if (exact ? h === n : h.includes(n)) return i;
      }
    }
  }
  return -1;
}

/** Kopfzeile suchen: viele Exporte haben Vorspann (Konto, Zeitraum, Leerzeilen). */
function findHeaderRow(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const hasDate = matchColumn(cells, "date") !== -1;
    const hasMoney = matchColumn(cells, "amount") !== -1 || (matchColumn(cells, "debit") !== -1 && matchColumn(cells, "credit") !== -1);
    if (hasDate && hasMoney) return i;
  }
  return -1;
}

/* ---------- Werte deuten ---------- */

/**
 * Zahl lesen, ohne das Format vorauszusetzen.
 * "1.234,56" (deutsch) und "1,234.56" (englisch) unterscheiden sich nur in der
 * Reihenfolge — entschieden wird über das letzte Trennzeichen.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[\s ]/g, "").replace(/[€$£]/g, "").replace(/"/g, "");
  if (!s) return null;

  // Vorzeichen kann hinten stehen ("1.234,56-") oder als Klammer ("(1.234,56)")
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Das weiter hinten stehende ist das Dezimaltrennzeichen
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Nur Komma: Dezimaltrenner, außer es sieht nach Tausendergruppen aus (1,234)
    const after = s.length - lastComma - 1;
    s = after === 3 && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot !== -1) {
    const after = s.length - lastDot - 1;
    if (after === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Datum lesen: ISO, DD.MM.YYYY, DD/MM/YYYY und zweistellige Jahre. */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, "");

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const de = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(s);
  if (de) {
    const day = de[1].padStart(2, "0");
    const month = de[2].padStart(2, "0");
    let year = de[3];
    if (year.length === 2) year = String(Number(year) > 70 ? 1900 + Number(year) : 2000 + Number(year));
    if (Number(month) > 12) return null; // MM/DD wäre uneindeutig — lieber nichts als falsch
    return `${year}-${month}-${day}`;
  }
  return null;
}

/* ---------- Hauptfunktion ---------- */

export function parseStatementCsv(text: string): ParseResult {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new CsvError("Die Datei enthält keine Datenzeilen.");

  const delimiter = detectDelimiter(lines);
  const headerRow = findHeaderRow(lines, delimiter);
  if (headerRow === -1) {
    throw new CsvError(
      "In der Datei wurde keine Kopfzeile mit Datum und Betrag gefunden. Erwartet werden Spalten wie „Buchungstag“/„Date“ und „Betrag“/„Amount“ — oder getrennte Soll- und Haben-Spalten."
    );
  }

  const header = splitLine(lines[headerRow], delimiter);
  // "Soll/Haben" ist eine Kennzeichen-Spalte und enthält beide Wörter — ohne
  // Ausschluss würde sie zugleich als Soll- und als Haben-Betragsspalte gelten.
  const signCol = matchColumn(header, "sign");
  const col = {
    date: matchColumn(header, "date"),
    amount: matchColumn(header, "amount"),
    debit: matchColumn(header, "debit", signCol !== -1 ? [signCol] : []),
    credit: matchColumn(header, "credit", signCol !== -1 ? [signCol] : []),
    sign: signCol,
    currency: matchColumn(header, "currency"),
    merchant: matchColumn(header, "merchant"),
    description: matchColumn(header, "description"),
    balance: matchColumn(header, "balance"),
    state: matchColumn(header, "state"),
  };

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const line of lines.slice(headerRow + 1)) {
    const cells = splitLine(line, delimiter);
    const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");

    const date = parseDate(at(col.date));
    if (!date) { skipped++; continue; }

    let amount: number | null = null;
    if (col.amount !== -1) {
      amount = parseAmount(at(col.amount));
      // Getrennte Kennzeichen-Spalte ("S"/"H") liefert das Vorzeichen
      if (amount !== null && col.sign !== -1) {
        const sign = at(col.sign).toUpperCase();
        if (/^(S|D|DBIT|SOLL)/.test(sign)) amount = -Math.abs(amount);
        else if (/^(H|C|CRDT|HABEN)/.test(sign)) amount = Math.abs(amount);
      }
    } else if (col.debit !== -1 || col.credit !== -1) {
      // Getrennte Soll-/Haben-Spalten: gefüllt ist immer nur eine
      const debit = parseAmount(at(col.debit));
      const credit = parseAmount(at(col.credit));
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    }
    if (amount === null || !Number.isFinite(amount)) { skipped++; continue; }

    const stateRaw = at(col.state).toUpperCase();
    // Nur eindeutig Unfertiges auslassen; unbekannte Status als gebucht werten
    if (/REVERTED|DECLINED|FAILED|STORNIERT|ABGELEHNT/.test(stateRaw)) { skipped++; continue; }

    rows.push({
      date,
      amount,
      currency: at(col.currency) || null,
      merchant: at(col.merchant) || null,
      description: at(col.description) || null,
      balance: col.balance !== -1 ? parseAmount(at(col.balance)) : null,
      pending: /PENDING|VORGEMERKT/.test(stateRaw),
    });
  }

  if (rows.length === 0) {
    throw new CsvError("Es konnte keine einzige Buchung gelesen werden — Datums- oder Betragsspalte passen nicht.");
  }

  const mapping: Record<string, string> = {};
  for (const [key, idx] of Object.entries(col)) {
    if (idx !== -1) mapping[key] = header[idx];
  }

  return { rows, skipped, delimiter, headerRow, mapping };
}

/* ---------- Depot-/Broker-Exporte ---------- */

export type ParsedPosition = {
  name: string;
  symbol: string | null;
  units: number;
  buyPricePerUnit: number;   // in der Währung der Datei
  currentPrice: number | null;
  currency: string;
  kind: "stock" | "etf" | "crypto" | "other";
};

export type PositionsResult = {
  positions: ParsedPosition[];
  skipped: number;
  /** "positions" = Bestandsliste, "transactions" = Orderliste (verrechnet) */
  mode: "positions" | "transactions";
  delimiter: string;
  headerRow: number;
  mapping: Record<string, string>;
  currencies: string[];
};

/** Anlageart raten — nur eine Vorbelegung, in der Oberfläche änderbar. */
function guessKind(name: string, symbol: string | null): ParsedPosition["kind"] {
  const s = `${name} ${symbol ?? ""}`.toLowerCase();
  if (/\b(btc|eth|xrp|sol|ada|doge|bitcoin|ethereum)\b/.test(s) || /-(eur|usd)$/i.test(symbol ?? "")) return "crypto";
  if (/\betf\b|ucits|index|msci|s&p|ftse/.test(s)) return "etf";
  return "stock";
}

/** Kopfzeile eines Depot-Exports: braucht Stückzahl und irgendeine Kennung. */
function findPositionsHeader(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const hasUnits = matchColumn(cells, "units", [], POS_ALIASES) !== -1;
    const hasId = matchColumn(cells, "symbol", [], POS_ALIASES) !== -1 || matchColumn(cells, "secname", [], POS_ALIASES) !== -1;
    if (hasUnits && hasId) return i;
  }
  return -1;
}

const BUY = /^(k|kauf|buy|purchase|b|einbuchung|zugang)/i;
const SELL = /^(v|verkauf|sell|sale|s|ausbuchung|abgang)/i;

export function parsePositionsCsv(text: string): PositionsResult {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new CsvError("Die Datei enthält keine Datenzeilen.");

  const delimiter = detectDelimiter(lines);
  const headerRow = findPositionsHeader(lines, delimiter);
  if (headerRow === -1) {
    throw new CsvError(
      "In der Datei wurde keine Kopfzeile für ein Depot gefunden. Erwartet werden eine Stückzahl-Spalte („Anzahl“/„Quantity“) und eine Kennung („Symbol“/„ISIN“/„Bezeichnung“)."
    );
  }

  const header = splitLine(lines[headerRow], delimiter);
  const m = (key: string, exclude: number[] = []) => matchColumn(header, key, exclude, POS_ALIASES);

  const priceCol = m("price");
  const col = {
    symbol: m("symbol"),
    secname: m("secname"),
    units: m("units"),
    price: priceCol,
    // "Kurs" träfe sonst denselben Treffer wie der Einstandskurs
    curprice: m("curprice", priceCol !== -1 ? [priceCol] : []),
    total: m("total"),
    action: m("action"),
    fee: m("fee"),
    currency: m("currency"),
    date: m("date"),
  };

  // Orderliste oder Bestand? Entscheidend ist, ob eine Typ-Spalte tatsächlich
  // Kauf/Verkauf enthält — "Typ" allein kann auch „Aktie/ETF“ bedeuten.
  const body = lines.slice(headerRow + 1);
  const actionValues = col.action === -1 ? [] : body.map((l) => splitLine(l, delimiter)[col.action] ?? "");
  const isTransactions = actionValues.some((v) => BUY.test(v.trim())) && col.date !== -1;

  const currencies = new Set<string>();
  let skipped = 0;

  /** Laufende Verrechnung je Wertpapier: Stück und Einstandssumme. */
  const acc = new Map<string, { name: string; symbol: string | null; units: number; cost: number; currency: string; curprice: number | null }>();

  for (const line of body) {
    const cells = splitLine(line, delimiter);
    const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");

    const symbol = at(col.symbol).trim() || null;
    const name = at(col.secname).trim() || symbol || "";
    if (!name) { skipped++; continue; }

    const units = parseAmount(at(col.units));
    if (units === null || units === 0) { skipped++; continue; }

    let perUnit = col.price !== -1 ? parseAmount(at(col.price)) : null;
    const total = col.total !== -1 ? parseAmount(at(col.total)) : null;
    // Nur Gesamtwert vorhanden? Dann ergibt sich der Stückpreis daraus.
    if (perUnit === null && total !== null) perUnit = Math.abs(total) / Math.abs(units);
    if (perUnit === null) { skipped++; continue; }
    perUnit = Math.abs(perUnit);

    const cur = (at(col.currency).trim() || "EUR").toUpperCase().slice(0, 3);
    currencies.add(cur);
    const curprice = col.curprice !== -1 ? parseAmount(at(col.curprice)) : null;
    const fee = col.fee !== -1 ? Math.abs(parseAmount(at(col.fee)) ?? 0) : 0;

    const key = (symbol || name).toUpperCase();
    const entry = acc.get(key) ?? { name, symbol, units: 0, cost: 0, currency: cur, curprice: null };
    if (curprice !== null) entry.curprice = Math.abs(curprice);

    if (isTransactions) {
      const action = at(col.action).trim();
      const qty = Math.abs(units);
      if (SELL.test(action)) {
        // Verkauf: Stück abziehen und den Einstand anteilig mindern, damit der
        // Durchschnittskurs der verbleibenden Stücke unverändert bleibt.
        const avg = entry.units > 0 ? entry.cost / entry.units : 0;
        entry.units -= qty;
        entry.cost -= avg * qty;
        if (entry.units <= 1e-9) { entry.units = 0; entry.cost = 0; }
      } else if (BUY.test(action)) {
        // Gebühren gehören zum Einstand — sie sind Teil dessen, was der Kauf gekostet hat
        entry.units += qty;
        entry.cost += qty * perUnit + fee;
      } else {
        skipped++;
        continue;
      }
    } else {
      entry.units += Math.abs(units);
      entry.cost += Math.abs(units) * perUnit;
    }
    acc.set(key, entry);
  }

  const positions: ParsedPosition[] = [];
  for (const e of acc.values()) {
    // Vollständig verkaufte Werte sind kein Bestand mehr
    if (e.units <= 1e-9) continue;
    positions.push({
      name: e.name,
      symbol: e.symbol,
      units: e.units,
      buyPricePerUnit: e.cost / e.units,
      currentPrice: e.curprice,
      currency: e.currency,
      kind: guessKind(e.name, e.symbol),
    });
  }

  if (positions.length === 0) {
    // Zwei sehr verschiedene Fälle, die sich sonst hinter derselben Meldung
    // verstecken: gar nichts verstanden — oder alles verstanden und am Ende
    // ist schlicht kein Bestand übrig (alles verkauft).
    throw new CsvError(
      acc.size > 0
        ? "Die Datei wurde gelesen, aber es bleibt kein Bestand übrig — alle enthaltenen Positionen sind vollständig verkauft."
        : "Es konnte keine einzige Position gelesen werden — Stückzahl- oder Kursspalte passen nicht."
    );
  }

  const mapping: Record<string, string> = {};
  for (const [key, idx] of Object.entries(col)) {
    if (idx !== -1) mapping[key] = header[idx];
  }

  return {
    positions,
    skipped,
    mode: isTransactions ? "transactions" : "positions",
    delimiter,
    headerRow,
    mapping,
    currencies: [...currencies],
  };
}
