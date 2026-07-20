/**
 * Instrument search.
 *
 * Yahoo's search endpoint already resolves an ISIN to its tickers, so the work
 * here is ranking: an ISIN query returns both the real ticker and a synthetic
 * "<ISIN>.SG" entry, and the ticker is the one that actually carries quotes.
 */

export type Hit = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  /** True when this row was reached by ISIN rather than by name. */
  viaIsin?: boolean;
};

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/**
 * ISIN check digit (Luhn over the letter-expanded string, A=10 … Z=35).
 * Validating locally keeps a typo from being sent out as a name search that
 * returns confident-looking nonsense.
 */
export function isIsin(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  if (!ISIN_RE.test(s)) return false;

  const digits = [...s.slice(0, 11)]
    .map((c) => (c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c))
    .join("");

  let sum = 0;
  let double = true; // rightmost body digit is doubled
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(s[11]);
}

/** Exchanges a European private investor can actually buy on, best first. */
const PREFERRED = ["GER", "STU", "AMS", "LSE", "PAR", "MIL", "SWX"];

export function rankHits(hits: Hit[], query: string): Hit[] {
  const isin = isIsin(query);
  return [...hits]
    .map((h) => {
      let score = 0;
      // The synthetic ISIN-as-ticker row can't be traded and often lacks quotes
      if (h.symbol.toUpperCase().startsWith(query.trim().toUpperCase()) && isin) score -= 50;
      if (h.type === "ETF") score += 30;
      else if (h.type === "EQUITY") score += 20;
      else if (h.type === "MUTUALFUND") score += 5;
      const rank = PREFERRED.indexOf(h.exchange);
      if (rank >= 0) score += 15 - rank * 2;
      return { h, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ h }) => ({ ...h, viaIsin: isin || undefined }));
}

export async function searchInstruments(query: string, limit = 8): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    "https://query1.finance.yahoo.com/v1/finance/search" +
    `?q=${encodeURIComponent(q)}&quotesCount=${limit + 4}&newsCount=0`;

  // Slim UA — the full browser string gets rate-limited far sooner
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Suche nicht erreichbar (${res.status})`);

  const data = (await res.json()) as { quotes?: Array<Record<string, unknown>> };
  const hits: Hit[] = (data.quotes ?? [])
    .filter((r) => typeof r.symbol === "string")
    .map((r) => ({
      symbol: String(r.symbol),
      name: String(r.longname ?? r.shortname ?? r.symbol),
      exchange: String(r.exchange ?? ""),
      type: String(r.quoteType ?? ""),
    }));

  return rankHits(hits, q).slice(0, limit);
}
