/**
 * Aktien-/ETF-/Krypto-Kurse über die öffentliche Yahoo-Finance-Chart-API (ohne API-Key).
 * Symbole im Yahoo-Format: AAPL, IWDA.AS, VWCE.DE, BTC-EUR, ^GSPC …
 * 5-Minuten-Cache in SQLite, EUR-Umrechnung via frankfurter.app.
 */
import { db } from "./db";

const CACHE_TTL_MS = 5 * 60 * 1000;
const UA = "Mozilla/5.0";

export type Quote = {
  symbol: string;
  name: string | null;
  price: number;
  prevClose: number | null;
  changePct: number | null;
  currency: string;
  priceEur: number | null;
  fetchedAt: string;
  stale: boolean;
};

const fxCache = new Map<string, { rate: number; at: number }>();

async function toEurRate(currency: string): Promise<number | null> {
  if (currency === "EUR") return 1;
  const hit = fxCache.get(currency);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.rate;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${currency}&to=EUR`, { cache: "no-store" });
    if (!res.ok) return null;
    const rate = (await res.json()).rates?.EUR;
    if (typeof rate !== "number") return null;
    fxCache.set(currency, { rate, at: Date.now() });
    return rate;
  } catch {
    return null;
  }
}

async function fetchYahoo(symbol: string): Promise<Omit<Quote, "priceEur" | "fetchedAt" | "stale"> | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const meta = (await res.json())?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    let price = meta.regularMarketPrice as number;
    let prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? null) as number | null;
    let currency = (meta.currency as string) || "USD";
    // Londoner Notierungen in Pence → GBP
    if (currency === "GBp") {
      price /= 100;
      if (prevClose !== null) prevClose /= 100;
      currency = "GBP";
    }

    return {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || null,
      price,
      prevClose,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : null,
      currency,
    };
  } catch {
    return null;
  }
}

export async function getQuote(symbol: string, force = false): Promise<Quote | null> {
  const d = db();
  const cached = d.prepare("SELECT * FROM quote_cache WHERE symbol = ?").get(symbol) as
    | { symbol: string; price: number; prev_close: number | null; currency: string; name: string | null; price_eur: number | null; fetched_at: string }
    | undefined;

  const fresh = cached && Date.now() - new Date(cached.fetched_at).getTime() <= CACHE_TTL_MS;
  if (!force && fresh) {
    return {
      symbol: cached.symbol,
      name: cached.name,
      price: cached.price,
      prevClose: cached.prev_close,
      changePct: cached.prev_close ? ((cached.price - cached.prev_close) / cached.prev_close) * 100 : null,
      currency: cached.currency,
      priceEur: cached.price_eur,
      fetchedAt: cached.fetched_at,
      stale: false,
    };
  }

  const live = await fetchYahoo(symbol);
  if (!live) {
    if (!cached) return null;
    return {
      symbol: cached.symbol,
      name: cached.name,
      price: cached.price,
      prevClose: cached.prev_close,
      changePct: cached.prev_close ? ((cached.price - cached.prev_close) / cached.prev_close) * 100 : null,
      currency: cached.currency,
      priceEur: cached.price_eur,
      fetchedAt: cached.fetched_at,
      stale: true,
    };
  }

  const rate = await toEurRate(live.currency);
  const priceEur = rate !== null ? live.price * rate : null;
  const fetchedAt = new Date().toISOString();

  d.prepare(
    `INSERT INTO quote_cache (symbol, price, prev_close, currency, name, price_eur, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET price = excluded.price, prev_close = excluded.prev_close,
       currency = excluded.currency, name = COALESCE(excluded.name, quote_cache.name),
       price_eur = excluded.price_eur, fetched_at = excluded.fetched_at`
  ).run(symbol, live.price, live.prevClose, live.currency, live.name, priceEur, fetchedAt);

  return { ...live, symbol, priceEur, fetchedAt, stale: false };
}

export async function getQuotes(symbols: string[], force = false): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  // sequenziell mit kleiner Parallelität, um Yahoo nicht zu triggern
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 4) chunks.push(symbols.slice(i, i + 4));
  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map((s) => getQuote(s, force)));
    results.forEach((q, i) => { if (q) out.set(chunk[i], q); });
  }
  return out;
}


/* ---------- Kursverlauf für den Hover-Chart ---------- */

export type HistoryPoint = { t: number; c: number };

// Verlauf ändert sich täglich, nicht sekündlich — großzügig cachen, sonst
// feuert jedes Überfahren mit der Maus eine Anfrage an Yahoo.
const historyCache = new Map<string, { at: number; data: HistoryPoint[] }>();
const HISTORY_TTL_MS = 60 * 60 * 1000;

/**
 * Selectable ranges and the candle interval each one needs.
 *
 * The interval has to follow the range: asking for one day at a daily interval
 * returns a single point and draws nothing, while five years at a daily
 * interval is ~1300 points of needless payload. An allowlist also keeps
 * user input from reaching Yahoo's query string.
 */
export const RANGES = {
  "1d": "5m",
  "5d": "30m",
  "1mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
} as const;

export type Range = keyof typeof RANGES;

export function isRange(v: unknown): v is Range {
  return typeof v === "string" && v in RANGES;
}

export async function getHistory(symbol: string, range: Range | string = "6mo"): Promise<HistoryPoint[] | null> {
  const safeRange: Range = isRange(range) ? range : "6mo";
  const interval = RANGES[safeRange];
  const key = `${symbol}|${safeRange}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.data;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${safeRange}`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return hit?.data ?? null;

    const result = (await res.json())?.chart?.result?.[0];
    const stamps: number[] = result?.timestamp ?? [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
    let scale = 1;
    // Londoner Notierungen kommen in Pence — wie beim Live-Kurs umrechnen,
    // sonst passt der Verlauf nicht zum angezeigten Kurs.
    if (result?.meta?.currency === "GBp") scale = 0.01;

    const data: HistoryPoint[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const c = closes[i];
      // Feiertage liefern null — auslassen statt als 0 zu zeichnen
      if (typeof c === "number") data.push({ t: stamps[i] * 1000, c: c * scale });
    }
    if (data.length === 0) return hit?.data ?? null;

    historyCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data ?? null;
  }
}
