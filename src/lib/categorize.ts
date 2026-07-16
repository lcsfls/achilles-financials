export const CATEGORIES = [
  "Lebensmittel",
  "Restaurants & Cafés",
  "Transport",
  "Shopping",
  "Abos & Dienste",
  "Wohnen & Nebenkosten",
  "Gesundheit",
  "Reisen",
  "Unterhaltung",
  "Bildung",
  "Gehalt & Einnahmen",
  "Investments",
  "Bargeld",
  "Überweisungen",
  "Sonstiges",
] as const;

export type Category = (typeof CATEGORIES)[number];

const RULES: Array<[Category, RegExp]> = [
  ["Lebensmittel", /rewe|edeka|aldi|lidl|netto|penny|kaufland|denns|alnatura|rossmann|dm[\s-]|dm\b|supermarkt|grocery|spar\b|billa/i],
  ["Restaurants & Cafés", /restaurant|pizza|burger|sushi|mcdonald|kfc|subway|starbucks|caf[eé]|bäcker|baecker|bakery|lieferando|wolt|uber\s*eats|deliveroo|espresso|bar\b|kebap|d[oö]ner/i],
  ["Transport", /db\b|deutsche\s*bahn|bvg|mvg|hvv|vbb|uber(?!\s*eats)|bolt|free\s*now|shell|aral|esso|total|jet\b|tank|\bflix|lime|tier\b|voi\b|parken|parking|sixt|miles\b|share\s*now/i],
  ["Abos & Dienste", /netflix|spotify|youtube|disney|amazon\s*prime|prime\s*video|apple\.com\/bill|apple\s*services|icloud|google\s*one|adobe|openai|anthropic|github|dropbox|notion|vodafone|telekom|o2\b|1&1|congstar|mobilfunk|hosting|hetzner|netcup|ionos/i],
  ["Shopping", /amazon(?!\s*prime)|amzn|zalando|otto\b|ikea|mediamarkt|saturn|h&m|zara|uniqlo|about\s*you|ebay|etsy|douglas|decathlon|obi\b|bauhaus|hornbach|action\b|tedi|apple\s*store/i],
  ["Wohnen & Nebenkosten", /miete|rent\b|nebenkosten|strom|gas\b|stadtwerke|vattenfall|eon|e\.on|enbw|wasser|hausgeld|gez|rundfunk|versicherung|allianz|huk|axa|wohnung/i],
  ["Gesundheit", /apotheke|pharmacy|arzt|doctor|zahnarzt|klinik|hospital|fitness|gym\b|mcfit|urban\s*sports|rsg\s*group|physio|optiker|fielmann/i],
  ["Reisen", /hotel|airbnb|booking\.com|expedia|ryanair|lufthansa|easyjet|eurowings|wizz|airline|flug|hostel|trip\b/i],
  ["Unterhaltung", /kino|cinema|cinemaxx|uci\b|steam|playstation|nintendo|xbox|epic\s*games|eventim|ticketmaster|konzert|museum|theater/i],
  ["Bildung", /udemy|coursera|skillshare|buch|thalia|hugendubel|kurs\b|seminar|uni\b|studierendenwerk/i],
  ["Gehalt & Einnahmen", /gehalt|lohn|salary|payroll|honorar|rechnung\s*\d|invoice/i],
  ["Investments", /trade\s*republic|scalable|degiro|flatex|comdirect|etf|vanguard|ishares|msci|coinbase|kraken|bitpanda|binance|savings|vault|edelmetall|gold|silber|philoro|degussa|proaurum/i],
  ["Bargeld", /atm|cash|geldautomat|withdrawal|abhebung|auszahlung/i],
  ["Überweisungen", /überweisung|transfer|sepa|revolut\s*user|to\s+[A-ZÄÖÜ][a-zäöü]+\s+[A-ZÄÖÜ]/i],
];

export function categorize(merchant: string | null, description: string | null, amount: number): Category {
  const hay = `${merchant ?? ""} ${description ?? ""}`;
  for (const [cat, re] of RULES) {
    if (re.test(hay)) {
      // income heuristics beat merchant match for positive amounts
      if (amount > 0 && cat !== "Gehalt & Einnahmen" && /gehalt|lohn|salary|payroll/i.test(hay)) return "Gehalt & Einnahmen";
      return cat;
    }
  }
  if (amount > 0) return "Gehalt & Einnahmen";
  return "Sonstiges";
}

export const CATEGORY_COLORS: Record<string, string> = {
  "Lebensmittel": "#34d399",
  "Restaurants & Cafés": "#fbbf24",
  "Transport": "#38bdf8",
  "Shopping": "#f472b6",
  "Abos & Dienste": "#a78bfa",
  "Wohnen & Nebenkosten": "#fb923c",
  "Gesundheit": "#4ade80",
  "Reisen": "#22d3ee",
  "Unterhaltung": "#e879f9",
  "Bildung": "#93c5fd",
  "Gehalt & Einnahmen": "#d4af37",
  "Investments": "#e9cd6f",
  "Bargeld": "#94a3b8",
  "Überweisungen": "#7dd3fc",
  "Sonstiges": "#6b7280",
};
