import { db } from "./db";

export const METALS: Record<string, { name: string; color: string }> = {
  XAU: { name: "Gold", color: "#d4af37" },
  XAG: { name: "Silber", color: "#c0c7d1" },
  XPT: { name: "Platin", color: "#8fa3b8" },
  XPD: { name: "Palladium", color: "#b8a9c9" },
};

const OZ_IN_GRAMS = 31.1034768;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchUsdToEur(): Promise<number> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", { cache: "no-store" });
  if (!res.ok) throw new Error("FX-Kurs nicht abrufbar");
  const data = await res.json();
  return data.rates.EUR as number;
}

async function fetchSpotUsdPerOz(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${symbol}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.price === "number" ? data.price : null;
  } catch {
    return null;
  }
}

export type SpotPrice = { symbol: string; name: string; eurPerGram: number; usdPerOz: number | null; fetchedAt: string; stale: boolean };

export async function getSpotPrices(force = false): Promise<SpotPrice[]> {
  const d = db();
  const now = Date.now();
  const results: SpotPrice[] = [];

  const cached = new Map<string, { eur_per_gram: number; usd_per_oz: number | null; fetched_at: string }>();
  for (const row of d.prepare("SELECT * FROM price_cache").all() as Array<{ symbol: string; eur_per_gram: number; usd_per_oz: number | null; fetched_at: string }>) {
    cached.set(row.symbol, row);
  }

  const needsFetch = force || Object.keys(METALS).some((s) => {
    const c = cached.get(s);
    return !c || now - new Date(c.fetched_at).getTime() > CACHE_TTL_MS;
  });

  let usdToEur: number | null = null;
  if (needsFetch) {
    usdToEur = await fetchUsdToEur().catch(() => null);
  }

  for (const symbol of Object.keys(METALS)) {
    const c = cached.get(symbol);
    const fresh = c && now - new Date(c.fetched_at).getTime() <= CACHE_TTL_MS;

    if (!force && fresh) {
      results.push({ symbol, name: METALS[symbol].name, eurPerGram: c.eur_per_gram, usdPerOz: c.usd_per_oz, fetchedAt: c.fetched_at, stale: false });
      continue;
    }

    const usdPerOz = usdToEur !== null ? await fetchSpotUsdPerOz(symbol) : null;
    if (usdPerOz !== null && usdToEur !== null) {
      const eurPerGram = (usdPerOz * usdToEur) / OZ_IN_GRAMS;
      const fetchedAt = new Date().toISOString();
      d.prepare(
        "INSERT INTO price_cache (symbol, eur_per_gram, usd_per_oz, fetched_at) VALUES (?, ?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET eur_per_gram = excluded.eur_per_gram, usd_per_oz = excluded.usd_per_oz, fetched_at = excluded.fetched_at"
      ).run(symbol, eurPerGram, usdPerOz, fetchedAt);
      results.push({ symbol, name: METALS[symbol].name, eurPerGram, usdPerOz, fetchedAt, stale: false });
    } else if (c) {
      results.push({ symbol, name: METALS[symbol].name, eurPerGram: c.eur_per_gram, usdPerOz: c.usd_per_oz, fetchedAt: c.fetched_at, stale: true });
    }
    // Kein Cache und kein Fetch möglich → Symbol wird ausgelassen
  }

  return results;
}

export type MetalHolding = {
  metal: string;
  name: string;
  color: string;
  totalGrams: number;
  totalCost: number;
  currentValue: number | null;
  eurPerGram: number | null;
  lots: Array<{
    id: number;
    grams: number;
    purchase_price_eur: number;
    purchase_date: string;
    vendor: string | null;
    note: string | null;
    currentValue: number | null;
    pl: number | null;
    plPct: number | null;
  }>;
};

export async function getMetalHoldings(): Promise<{ holdings: MetalHolding[]; spot: SpotPrice[]; totalValue: number; totalCost: number }> {
  const spot = await getSpotPrices().catch(() => [] as SpotPrice[]);
  const spotMap = new Map(spot.map((s) => [s.symbol, s.eurPerGram]));

  const lots = db()
    .prepare("SELECT * FROM metal_lots ORDER BY purchase_date DESC")
    .all() as Array<{ id: number; metal: string; grams: number; purchase_price_eur: number; purchase_date: string; vendor: string | null; note: string | null }>;

  const byMetal = new Map<string, typeof lots>();
  for (const lot of lots) {
    if (!byMetal.has(lot.metal)) byMetal.set(lot.metal, []);
    byMetal.get(lot.metal)!.push(lot);
  }

  const holdings: MetalHolding[] = [];
  let totalValue = 0;
  let totalCost = 0;

  for (const [metal, metalLots] of byMetal) {
    const eurPerGram = spotMap.get(metal) ?? null;
    const totalGrams = metalLots.reduce((s, l) => s + l.grams, 0);
    const cost = metalLots.reduce((s, l) => s + l.purchase_price_eur, 0);
    const value = eurPerGram !== null ? totalGrams * eurPerGram : null;
    totalCost += cost;
    if (value !== null) totalValue += value;

    holdings.push({
      metal,
      name: METALS[metal]?.name ?? metal,
      color: METALS[metal]?.color ?? "#999",
      totalGrams,
      totalCost: cost,
      currentValue: value,
      eurPerGram,
      lots: metalLots.map((l) => {
        const cv = eurPerGram !== null ? l.grams * eurPerGram : null;
        const pl = cv !== null ? cv - l.purchase_price_eur : null;
        return {
          ...l,
          currentValue: cv,
          pl,
          plPct: pl !== null && l.purchase_price_eur > 0 ? (pl / l.purchase_price_eur) * 100 : null,
        };
      }),
    });
  }

  holdings.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  return { holdings, spot, totalValue, totalCost };
}
