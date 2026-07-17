/**
 * Anzeigewährung.
 *
 * Intern rechnet und speichert alles in EUR — das bleibt die Basis, sonst
 * müssten sämtliche Spalten (*_eur) migriert werden. Umgerechnet wird erst bei
 * der Anzeige, mit Kursen von frankfurter.app (EZB-Referenzkurse).
 */

export const CURRENCIES = [
  { code: "EUR", symbol: "€", de: "Euro", en: "Euro" },
  { code: "USD", symbol: "$", de: "US-Dollar", en: "US dollar" },
  { code: "CHF", symbol: "CHF", de: "Schweizer Franken", en: "Swiss franc" },
  { code: "GBP", symbol: "£", de: "Britisches Pfund", en: "British pound" },
  { code: "SEK", symbol: "kr", de: "Schwedische Krone", en: "Swedish krona" },
  { code: "NOK", symbol: "kr", de: "Norwegische Krone", en: "Norwegian krone" },
  { code: "DKK", symbol: "kr", de: "Dänische Krone", en: "Danish krone" },
  { code: "PLN", symbol: "zł", de: "Polnischer Złoty", en: "Polish złoty" },
  { code: "CZK", symbol: "Kč", de: "Tschechische Krone", en: "Czech koruna" },
  { code: "CAD", symbol: "CA$", de: "Kanadischer Dollar", en: "Canadian dollar" },
  { code: "AUD", symbol: "A$", de: "Australischer Dollar", en: "Australian dollar" },
  { code: "JPY", symbol: "¥", de: "Japanischer Yen", en: "Japanese yen" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function isSupported(code: string): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

/** Kurse ab EUR. Ändern sich einmal täglich — großzügig cachen. */
let cache: { at: number; rates: Record<string, number> } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

export async function ratesFromEur(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;

  const symbols = CURRENCIES.map((c) => c.code).filter((c) => c !== "EUR").join(",");
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=EUR&to=${symbols}`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const rates = { EUR: 1, ...((await res.json()).rates ?? {}) } as Record<string, number>;
    cache = { at: Date.now(), rates };
    return rates;
  } catch {
    // Lieber alte Kurse als gar keine Anzeige; EUR stimmt immer.
    return cache?.rates ?? { EUR: 1 };
  }
}
