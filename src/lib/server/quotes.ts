/**
 * Aktien-/ETF-/Krypto-Kurse über die öffentliche Yahoo-Finance-Chart-API (ohne API-Key).
 * Symbole im Yahoo-Format: AAPL, IWDA.AS, VWCE.DE, BTC-EUR, ^GSPC …
 * 5-Minuten-Cache in SQLite, EUR-Umrechnung via frankfurter.app.
 */
import { db } from "./db";

const CACHE_TTL_MS = 5 * 60 * 1000;
const UA = "Mozilla/5.0";
/**
 * Upper bound for one call to Yahoo or the FX source. Without it a hanging
 * connection held the whole page: the watchlist waited for every quote.
 */
const FETCH_TIMEOUT_MS = 8000;

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
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${currency}&to=EUR`, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
      { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
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

/**
 * How a quote may be served:
 *  ttl          cached while younger than 5 minutes, otherwise fetched live
 *  cache-first  any cached quote, however old — live only if there is none.
 *               For a first paint that must not wait on Yahoo; the caller
 *               refreshes afterwards.
 *  force        always live
 */
export type QuoteMode = "ttl" | "cache-first" | "force";

export async function getQuote(symbol: string, mode: QuoteMode | boolean = "ttl"): Promise<Quote | null> {
  // Older call sites pass a boolean "force".
  const m: QuoteMode = mode === true ? "force" : mode === false ? "ttl" : mode;
  const d = db();
  const cached = d.prepare("SELECT * FROM quote_cache WHERE symbol = ?").get(symbol) as
    | { symbol: string; price: number; prev_close: number | null; currency: string; name: string | null; price_eur: number | null; fetched_at: string }
    | undefined;

  const fresh = cached && Date.now() - new Date(cached.fetched_at).getTime() <= CACHE_TTL_MS;
  if (cached && (m === "cache-first" || (m === "ttl" && fresh))) {
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

export async function getQuotes(symbols: string[], mode: QuoteMode | boolean = "ttl"): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  // A small pool instead of strict batches: one slow symbol no longer holds
  // up the next four. Kept small so Yahoo doesn't throttle us.
  const queue = [...symbols];
  const worker = async () => {
    for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
      const q = await getQuote(s, mode);
      if (q) out.set(s, q);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, worker));
  return out;
}

/** True when a quote is older than the cache window — the UI then refreshes it. */
export function isOutdated(q: Quote): boolean {
  return Date.now() - new Date(q.fetchedAt).getTime() > CACHE_TTL_MS;
}

/* ---------- Kursverlauf für den Hover-Chart ---------- */

export type HistoryPoint = { t: number; c: number };

/*
 * History is stored in SQLite (history_cache), not only in memory: the
 * sparklines on every watchlist tile read it, and an in-memory cache was empty
 * after each restart — every tile then waited on Yahoo again.
 *
 * Daily candles change once a day, intraday ones every few minutes.
 */
const HISTORY_TTL_MS: Record<string, number> = {
  "1d": 5 * 60 * 1000,
  "5d": 30 * 60 * 1000,
};
const HISTORY_TTL_DEFAULT_MS = 6 * 60 * 60 * 1000;

function readHistory(symbol: string, range: string): { at: number; data: HistoryPoint[] } | null {
  const row = db()
    .prepare("SELECT fetched_at, data FROM history_cache WHERE symbol = ? AND range = ?")
    .get(symbol, range) as { fetched_at: string; data: string } | undefined;
  if (!row) return null;
  try {
    return { at: new Date(row.fetched_at).getTime(), data: JSON.parse(row.data) as HistoryPoint[] };
  } catch {
    return null;
  }
}

function writeHistory(symbol: string, range: string, data: HistoryPoint[]) {
  db()
    .prepare(
      `INSERT INTO history_cache (symbol, range, fetched_at, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(symbol, range) DO UPDATE SET fetched_at = excluded.fetched_at, data = excluded.data`
    )
    .run(symbol, range, new Date().toISOString(), JSON.stringify(data));
}

/** Symbols whose history is being fetched right now — no duplicate requests. */
const inFlight = new Map<string, Promise<HistoryPoint[] | null>>();

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

/**
 * Price history for a symbol.
 *
 * cacheFirst: return whatever is stored, however old, and refresh it in the
 * background when it has expired — for the sparklines, where yesterday's
 * curve is fine and waiting is not.
 */
export async function getHistory(
  symbol: string,
  range: Range | string = "6mo",
  opts: { cacheFirst?: boolean } = {}
): Promise<HistoryPoint[] | null> {
  const safeRange: Range = isRange(range) ? range : "6mo";
  const hit = readHistory(symbol, safeRange);
  const ttl = HISTORY_TTL_MS[safeRange] ?? HISTORY_TTL_DEFAULT_MS;
  const fresh = hit && Date.now() - hit.at < ttl;
  if (hit && fresh) return hit.data;

  if (hit && opts.cacheFirst) {
    fetchHistory(symbol, safeRange).catch(() => {});
    return hit.data;
  }
  return (await fetchHistory(symbol, safeRange)) ?? hit?.data ?? null;
}

function fetchHistory(symbol: string, range: Range): Promise<HistoryPoint[] | null> {
  const key = `${symbol}|${range}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = fetchHistoryLive(symbol, range).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function fetchHistoryLive(symbol: string, range: Range): Promise<HistoryPoint[] | null> {
  const interval = RANGES[range];
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) return null;

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
    if (data.length === 0) return null;

    writeHistory(symbol, range, data);
    return data;
  } catch {
    return null;
  }
}
