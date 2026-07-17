/**
 * Jeder Dienst, den Achilles von sich aus kontaktiert.
 *
 * Bewusst eine Liste im Code und keine Prosa in der README: Sie steht in den
 * Einstellungen und muss stimmen. Wer hier einen Aufruf hinzufügt, ohne die
 * Liste zu ergänzen, macht die Seite zur Lüge — deshalb liegt sie neben dem
 * Code und nicht in der Dokumentation.
 *
 * Beide Sprachen stehen direkt hier statt im i18n-Wörterbuch: Es sind lange,
 * zusammenhängende Texte, die nur an dieser einen Stelle vorkommen.
 *
 * Stand geprüft gegen alle fetch()-Aufrufe auf externe Hosts.
 */

type Text = { de: string; en: string };

export type Service = {
  host: string;
  /** Wofür der Aufruf gemacht wird. */
  purpose: Text;
  /** Was dabei den Server verlässt — der eigentliche Punkt dieser Seite. */
  sends: Text;
  /** Wann der Aufruf passiert. */
  when: Text;
  /** true = läuft nur, wenn du die Funktion nutzt bzw. die Integration aktivierst. */
  optional: boolean;
  /** Wo im Code, damit es nachprüfbar ist statt geglaubt werden zu müssen. */
  source: string;
  privacyUrl?: string;
};

export const SERVICES: Service[] = [
  {
    host: "query1.finance.yahoo.com",
    purpose: {
      de: "Kurse und Kursverläufe für Watchlist und Investments",
      en: "Prices and price history for the watchlist and investments",
    },
    sends: {
      de: "Nur das abgefragte Symbol (z. B. „AAPL“). Keine Stückzahlen, keine Beträge, keine Kennung von dir — der Aufruf ist nicht angemeldet.",
      en: "Only the symbol being queried (e.g. “AAPL”). No quantities, no amounts, nothing identifying you — the call is unauthenticated.",
    },
    when: {
      de: "Beim Öffnen von Watchlist oder Investments und bei „Kurse aktualisieren“. Ergebnisse werden 5 Minuten zwischengespeichert, Verläufe 1 Stunde.",
      en: "When the watchlist or investments page opens, and on “Refresh prices”. Results are cached for 5 minutes, history for 1 hour.",
    },
    optional: true,
    source: "src/lib/quotes.ts",
    privacyUrl: "https://legal.yahoo.com/us/en/yahoo/privacy/index.html",
  },
  {
    host: "api.gold-api.com",
    purpose: {
      de: "Spotpreise für Gold, Silber, Platin und Palladium",
      en: "Spot prices for gold, silver, platinum and palladium",
    },
    sends: {
      de: "Nur das Metall-Kürzel (XAU, XAG, XPT, XPD). Deine Bestände bleiben hier.",
      en: "Only the metal code (XAU, XAG, XPT, XPD). Your holdings stay here.",
    },
    when: {
      de: "Beim Öffnen der Edelmetall-Seite und bei „Kurse aktualisieren“.",
      en: "When the precious metals page opens, and on “Refresh prices”.",
    },
    optional: true,
    source: "src/lib/metals.ts",
  },
  {
    host: "api.frankfurter.dev",
    purpose: {
      de: "Wechselkurse (EZB-Referenzkurse) für die Anzeigewährung und für Kurse in Fremdwährung",
      en: "Exchange rates (ECB reference rates) for the display currency and for prices quoted in other currencies",
    },
    sends: {
      de: "Nur Währungspaare (z. B. „USD→EUR“). Keine Beträge — umgerechnet wird bei dir.",
      en: "Only currency pairs (e.g. “USD→EUR”). No amounts — the conversion happens on your server.",
    },
    when: {
      de: "Beim Laden der Oberfläche und beim Kursabruf. Kurse werden 6 Stunden zwischengespeichert.",
      en: "When the interface loads and when prices are fetched. Rates are cached for 6 hours.",
    },
    optional: false,
    source: "src/lib/currency.ts, src/lib/quotes.ts, src/lib/metals.ts",
  },
  {
    host: "api.github.com",
    purpose: {
      de: "Prüfen, ob eine neuere Version veröffentlicht ist",
      en: "Checking whether a newer version has been published",
    },
    sends: {
      de: "Nichts über dich — nur die Anfrage nach den Releases und Tags des öffentlichen Repos. Der Aufruf ist nicht angemeldet.",
      en: "Nothing about you — just a request for the public repository's releases and tags. The call is unauthenticated.",
    },
    when: {
      de: "Beim Öffnen der Einstellungen. Ergebnis wird 10 Minuten zwischengespeichert.",
      en: "When the settings page opens. The result is cached for 10 minutes.",
    },
    optional: false,
    source: "src/lib/version.ts",
    privacyUrl: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
  },
  {
    host: "api.enablebanking.com",
    purpose: {
      de: "Bankanbindung über PSD2 — Salden und Umsätze abrufen",
      en: "Bank connection over PSD2 — fetching balances and transactions",
    },
    sends: {
      de: "Deine Kontodaten laufen über diesen Dienst: Er ist der zugelassene Kontoinformationsdienst zwischen dir und der Bank. Achilles sendet ein signiertes Token mit deiner Application-ID; die Bank liefert Salden und Umsätze über ihn zurück. Der Private Key bleibt bei dir.",
      en: "Your account data passes through this service: it is the licensed account information provider between you and your bank. Achilles sends a signed token carrying your application ID; the bank returns balances and transactions through it. Your private key never leaves your server.",
    },
    when: {
      de: "Nur wenn die Integration aktiviert ist: beim Verbinden und bei jedem Sync.",
      en: "Only when the integration is enabled: when connecting and on every sync.",
    },
    optional: true,
    source: "src/lib/enablebanking.ts",
    privacyUrl: "https://enablebanking.com/privacy-policy/",
  },
  {
    host: "FinTS: deine Bank direkt",
    purpose: {
      de: "Bankanbindung über FinTS/HBCI — Umsätze und Depotbestände abrufen",
      en: "Bank connection over FinTS/HBCI — fetching transactions and portfolio holdings",
    },
    sends: {
      de: "Zugangsdaten und Anfragen gehen direkt an die FinTS-Adresse deiner Bank, ohne Dritten dazwischen. Kein Aggregator sieht diese Verbindung.",
      en: "Credentials and requests go straight to your bank's FinTS endpoint, with no third party in between. No aggregator sees this connection.",
    },
    when: {
      de: "Nur wenn die Integration aktiviert ist: bei Sync und Depotabruf.",
      en: "Only when the integration is enabled: on sync and on fetching the portfolio.",
    },
    optional: true,
    source: "src/lib/fints.ts",
  },
];
