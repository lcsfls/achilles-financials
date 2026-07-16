"use client";

/**
 * Leichtgewichtige i18n ohne Bibliothek: Die deutschen UI-Strings sind die Keys,
 * das EN-Wörterbuch übersetzt sie. Fehlende Keys fallen auf Deutsch zurück.
 * Platzhalter wie {n} werden nach der Übersetzung ersetzt.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setNumberLocale } from "./utils";

export type Lang = "de" | "en";

const EN: Record<string, string> = {
  // Navigation & Shell
  "Übersicht": "Overview",
  "Transaktionen": "Transactions",
  "Edelmetalle": "Precious Metals",
  "Investments": "Investments",
  "Vorsorge": "Pension",
  "FIRE": "FIRE",
  "Verbinden": "Connect",
  "Einstellungen": "Settings",

  // Kategorien
  "Lebensmittel": "Groceries",
  "Restaurants & Cafés": "Restaurants & Cafés",
  "Transport": "Transport",
  "Shopping": "Shopping",
  "Abos & Dienste": "Subscriptions & Services",
  "Wohnen & Nebenkosten": "Housing & Utilities",
  "Gesundheit": "Health",
  "Reisen": "Travel",
  "Unterhaltung": "Entertainment",
  "Bildung": "Education",
  "Gehalt & Einnahmen": "Salary & Income",
  "Bargeld": "Cash",
  "Überweisungen": "Transfers",
  "Sonstiges": "Other",
  "Weitere": "Other",

  // Metalle
  "Gold": "Gold",
  "Silber": "Silver",
  "Platin": "Platinum",
  "Palladium": "Palladium",

  // Übersicht
  "Portfolio wird geladen …": "Loading portfolio …",
  "Willkommen bei Achilles": "Welcome to Achilles",
  "Verbinde dein Konto per QR-Code oder starte mit Demo-Daten, um das Dashboard zu erkunden.":
    "Connect your bank via QR code or start with demo data to explore the dashboard.",
  "Konto verbinden": "Connect a bank",
  "Demo-Daten laden": "Load demo data",
  "Gesamtvermögen": "Net Worth",
  "Demo-Modus": "Demo mode",
  "Sync: {date}": "Sync: {date}",
  "Aktualisieren": "Refresh",
  "Liquidität": "Liquidity",
  "1 Konto": "1 account",
  "{n} Konten": "{n} accounts",
  "Ausgaben diesen Monat": "Spending this month",
  "{pct} vs. Vormonat": "{pct} vs. last month",
  "{amount} unrealisiert": "{amount} unrealized",
  "Altersvorsorge": "Pension",
  "Auszug vom {date}": "Statement of {date}",
  "noch kein Auszug erfasst": "no statement recorded yet",
  "Cashflow · letzte Monate": "Cash flow · recent months",
  "Einnahmen": "Income",
  "Ausgaben": "Spending",
  "Ausgaben nach Kategorie · {month}": "Spending by category · {month}",
  "Gesamt": "Total",
  "Letzte Transaktionen": "Recent transactions",
  "Alle ansehen →": "View all →",
  "Edelmetall-Allokation": "Precious metals allocation",
  "Details →": "Details →",
  "Noch keine Edelmetalle erfasst.": "No precious metals recorded yet.",

  // Transaktionen
  "{n} Buchungen": "{n} entries",
  "Händler oder Beschreibung suchen …": "Search merchant or description …",
  "Alle Kategorien": "All categories",
  "Alle Monate": "All months",
  "Lade Transaktionen …": "Loading transactions …",
  "Keine Transaktionen gefunden.": "No transactions found.",
  "ausstehend": "pending",
  "Kategorie ändern": "Change category",

  // Edelmetalle
  "Bestand": "Holdings",
  "Einstand": "Cost basis",
  "Kurse aktualisieren": "Refresh prices",
  "Kauf erfassen": "Add purchase",
  "Edelmetall-Kauf erfassen": "Record a metal purchase",
  "Jeder Kauf wird als eigene Position (Lot) mit Einstandspreis geführt.": "Each purchase is tracked as its own lot with its cost basis.",
  "Metall": "Metal",
  "Gewicht (Gramm)": "Weight (grams)",
  "Kaufpreis gesamt (€)": "Total purchase price (€)",
  "Kaufdatum": "Purchase date",
  "Händler (optional)": "Dealer (optional)",
  "Notiz (optional)": "Note (optional)",
  "1 oz Krügerrand": "1 oz Krugerrand",
  "Kauf speichern": "Save purchase",
  "Speichern …": "Saving …",
  "Spot": "Spot",
  "⚠ letzter bekannter Kurs": "⚠ last known price",
  "letzter bekannter Kurs": "last known price",
  "Stand {time}": "As of {time}",
  "Spotpreise derzeit nicht verfügbar — Kurse werden automatisch nachgeladen.": "Spot prices currently unavailable — they will reload automatically.",
  "Noch keine Bestände. Erfasse deinen ersten Kauf — Gold, Silber, Platin oder Palladium — mit Gewicht und Einstandspreis.":
    "No holdings yet. Record your first purchase — gold, silver, platinum or palladium — with weight and cost basis.",
  "kein Kurs": "no price",
  "Gewicht": "Weight",
  "Aktueller Wert": "Current value",
  "G/V": "P/L",
  "Händler / Notiz": "Dealer / note",
  "€/g Einstand": "€/g cost",
  "Löschen": "Delete",
  "Diesen Kauf wirklich löschen?": "Really delete this purchase?",
  "Lade Edelmetalle …": "Loading precious metals …",
  "Fehler beim Speichern": "Failed to save",

  // Investments & Watchlist
  "Depotwert": "Portfolio value",
  "Position hinzufügen": "Add position",
  "Mit Symbol im Yahoo-Format (AAPL, VWCE.DE, IWDA.AS, BTC-EUR) wird der Kurs über „Kurse aktualisieren“ automatisch gepflegt.":
    "With a Yahoo-format symbol (AAPL, VWCE.DE, IWDA.AS, BTC-EUR) prices are kept up to date via “Refresh prices”.",
  "Name": "Name",
  "Symbol · Yahoo-Format (optional)": "Symbol · Yahoo format (optional)",
  "Typ": "Type",
  "Aktie": "Stock",
  "Krypto": "Crypto",
  "Anzahl": "Units",
  "Kaufkurs / Stück (€)": "Buy price / unit (€)",
  "Aktueller Kurs / Stück (€, optional)": "Current price / unit (€, optional)",
  "Position speichern": "Save position",
  "Noch keine Positionen. Füge dein Depot hinzu, um Wertentwicklung und Allokation zu sehen.":
    "No positions yet. Add your portfolio to track performance and allocation.",
  "Position": "Position",
  "Kaufkurs": "Buy price",
  "Akt. Kurs": "Price",
  "Wert": "Value",
  "Kurs bearbeiten": "Edit price",
  "Position wirklich löschen?": "Really delete this position?",
  "{n} Kurse aktualisiert": "{n} prices updated",
  "Watchlist": "Watchlist",
  "Live-Kurse via Yahoo Finance · 5-Minuten-Cache": "Live prices via Yahoo Finance · 5-minute cache",
  "Symbol, z. B. NVDA, VWCE.DE": "Symbol, e.g. NVDA, VWCE.DE",
  "Hinzufügen": "Add",
  "Prüfe …": "Checking …",
  "Noch leer — füge Symbole hinzu, um Kurse zu beobachten (Yahoo-Format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).":
    "Empty — add symbols to watch prices (Yahoo format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).",
  "Entfernen": "Remove",
  "Lade Investments …": "Loading investments …",

  // Vorsorge
  "Betriebliche Altersvorsorge": "Occupational Pension",
  "Stände aus deinen Kontoauszügen erfassen — der aktuelle Stand fließt ins Gesamtvermögen und in den FIRE-Simulator ein.":
    "Record balances from your statements — the latest balance feeds into net worth and the FIRE simulator.",
  "Kontoauszug erfassen": "Add statement",
  "Datum und Stand vom Auszug übernehmen; eingezahlter Beitrag seit dem letzten Auszug ist optional.":
    "Take date and balance from the statement; contributions since the last statement are optional.",
  "Datum des Auszugs": "Statement date",
  "Stand / Guthaben (€)": "Balance (€)",
  "Beiträge seit letztem Auszug (€, optional)": "Contributions since last statement (€, optional)",
  "Jahresmitteilung": "Annual statement",
  "Speichern": "Save",
  "Aktueller Stand": "Current balance",
  "Erfasste Beiträge": "Recorded contributions",
  "Summe über {n} Auszüge": "Total across {n} statements",
  "Entwicklung seit Beginn": "Growth since start",
  "seit {date}": "since {date}",
  "Guthabenentwicklung": "Balance history",
  "Ab zwei erfassten Auszügen erscheint hier die Entwicklung deines Guthabens.": "Once two statements are recorded, your balance history appears here.",
  "Vertragsdaten": "Contract details",
  "Anbieter & laufender Beitrag": "Provider & ongoing contribution",
  "Anbieter / Versicherung": "Provider / insurer",
  "z. B. Direktversicherung": "e.g. direct insurance plan",
  "Monatlicher Beitrag gesamt (€, AG + AN)": "Total monthly contribution (€, employer + employee)",
  "Gespeichert": "Saved",
  "Kontoauszüge": "Statements",
  "Noch keine Auszüge erfasst.": "No statements recorded yet.",
  "Datum": "Date",
  "Stand": "Balance",
  "Beitrag seit letztem": "Contribution since last",
  "Δ zum Vorauszug": "Δ vs. previous",
  "Notiz": "Note",
  "Diesen Auszug wirklich löschen?": "Really delete this statement?",
  "Beitrag: {amount}": "Contribution: {amount}",
  "Lade Vorsorge …": "Loading pension …",

  // FIRE
  "FIRE-Simulator": "FIRE Simulator",
  "Financial Independence, Retire Early — alle Werte inflationsbereinigt in heutiger Kaufkraft (Realrendite {pct} % p. a.).":
    "Financial Independence, Retire Early — all values inflation-adjusted in today's purchasing power (real return {pct} % p.a.).",
  "Aktuelles Alter": "Current age",
  "{n} Jahre": "{n} years",
  "{n} J.": "{n} y",
  "> 60 J.": "> 60 y",
  "Sparrate / Monat": "Monthly savings",
  "Wunsch-Ausgaben im Ruhestand / Monat (heutige Kaufkraft)": "Desired monthly retirement spending (today's purchasing power)",
  "Erwartete Rendite p. a.": "Expected return p.a.",
  "Inflation p. a.": "Inflation p.a.",
  "Entnahmerate (SWR)": "Withdrawal rate (SWR)",
  "FIRE-Zahl": "FIRE number",
  "bei {pct} % Entnahme": "at {pct} % withdrawal",
  "Zeit bis FIRE": "Time to FIRE",
  "Erreicht 🎉": "Reached 🎉",
  "mit {age} Jahren ({year})": "at age {age} ({year})",
  "Startkapital": "Starting capital",
  "automatisch aus Portfolio": "automatic from portfolio",
  "manuell gesetzt": "set manually",
  "Fortschritt": "Progress",
  "{amount} fehlen": "{amount} to go",
  "Weg zur finanziellen Freiheit": "Road to financial independence",
  "Parameter": "Parameters",
  "Startkapital überschreiben": "Override starting capital",
  "manuell setzen": "set manually",
  "auf automatisch zurück": "back to automatic",
  "Vermögensprojektion (real)": "Wealth projection (real)",
  "Portfolio": "Portfolio",
  "Alter {age}": "Age {age}",
  "Modell: konstante Realrendite, monatliche Sparrate in heutiger Kaufkraft, FIRE-Zahl = Jahresausgaben ÷ Entnahmerate. Keine Steuern/Abgeltungsteuer, keine Sequence-of-Returns-Risiken — als Orientierung gedacht, nicht als Anlageberatung.":
    "Model: constant real return, monthly savings in today's purchasing power, FIRE number = annual spending ÷ withdrawal rate. No taxes, no sequence-of-returns risk — meant as guidance, not financial advice.",
  "Lade Simulator …": "Loading simulator …",

  // Verbinden
  "Bank verbinden": "Connect your bank",
  "Über die PSD2-Schnittstelle von Enable Banking — 2.700+ Banken in 30 europäischen Ländern. Du autorisierst den Zugriff direkt in deiner Banking-App. Achilles bekommt nur Lesezugriff auf Salden und Umsätze, niemals Zugriff auf Zahlungen.":
    "Through Enable Banking's PSD2 interface — 2,700+ banks across 30 European countries. You authorize access directly in your banking app. Achilles only gets read access to balances and transactions, never to payments.",
  "Bank verbunden! Starte jetzt die erste Synchronisierung.": "Bank connected! Now run the first sync.",
  "Enable-Banking-Zugangsdaten fehlen.": "Enable Banking credentials missing.",
  "Lege einen Account auf enablebanking.com an, registriere im Control Panel eine Anwendung und hinterlege Application-ID und Private Key in den":
    "Create an account at enablebanking.com, register an application in the Control Panel, and save the application ID and private key in",
  "Bank wählen": "Choose your bank",
  "Land": "Country",
  "Banken anzeigen": "Show banks",
  "Lade Banken …": "Loading banks …",
  "{n} Banken durchsuchen …": "Search {n} banks …",
  "Keine Bank gefunden.": "No bank found.",
  "Andere Bank wählen": "Choose a different bank",
  "QR-Code": "QR code",
  "QR-Code · Smartphone": "QR code · Smartphone",
  "Mit der Smartphone-Kamera scannen — der Link öffnet die Autorisierung, deine Banking-App übernimmt automatisch.":
    "Scan with your phone camera — the link opens the authorization and your banking app takes over automatically.",
  "Oder Link direkt auf diesem Gerät öffnen": "Or open the link directly on this device",
  "1 · Bank wählen": "1 · Choose your bank",
  "Land auswählen und deine Bank aus der Liste anklicken.": "Pick your country and select your bank from the list.",
  "2 · Mit dem Smartphone scannen": "2 · Scan with your phone",
  "In deiner Banking-App bestätigst du den Lesezugriff auf Salden und Transaktionen.":
    "In your banking app you confirm read access to balances and transactions.",
  "3 · Synchronisieren": "3 · Synchronize",
  "Achilles lädt bis zu 12 Monate Umsatzhistorie und kategorisiert alles automatisch.": "Achilles loads up to 12 months of history and categorizes everything automatically.",
  "Synchronisierung": "Synchronization",
  "{n} Konten verknüpft": "{n} accounts linked",
  "Noch keine Konten verknüpft": "No accounts linked yet",
  "zuletzt {date}": "last {date}",
  "Jetzt syncen": "Sync now",
  "Läuft …": "Running …",
  "Synchronisiert: {a} Konten, {n} Transaktionen.": "Synced: {a} accounts, {n} transactions.",
  "Alternative: CSV-Import": "Alternative: CSV import",
  "Ohne Bankanbindung: Kontoauszug als CSV aus deiner Banking-App exportieren und hier hochladen. Duplikate werden automatisch erkannt, manuelle Kategorien bleiben erhalten.":
    "Without a bank connection: export a statement as CSV from your banking app and upload it here. Duplicates are detected automatically, manual categories are preserved.",
  "CSV-Datei auswählen": "Choose CSV file",
  "Importiere …": "Importing …",
  "CSV importiert: {n} Transaktionen ({s} übersprungen).": "CSV imported: {n} transactions ({s} skipped).",

  // Einstellungen
  "API-Zugänge, Sprache und Daten verwalten.": "Manage API access, language and data.",
  "Sprache": "Language",
  "Sprache der Oberfläche und Zahlenformate": "Interface language and number formats",
  "PSD2-Schnittstelle zu 2.700+ Banken in Europa": "PSD2 interface to 2,700+ banks across Europe",
  "Konfiguriert": "Configured",
  "Nicht konfiguriert": "Not configured",
  "Account anlegen unter": "Create an account at",
  "im Control Panel eine Anwendung registrieren (Redirect-URL siehe unten) und den dabei erzeugten Private Key hier einfügen. Application-ID und Key bleiben ausschließlich in deiner lokalen SQLite-Datenbank.":
    "register an application in the Control Panel (redirect URL below) and paste the private key it generates here. The application ID and key never leave your local SQLite database.",
  "Redirect-URL für das Control Panel": "Redirect URL for the Control Panel",
  "Private Key (.pem-Inhalt)": "Private key (.pem contents)",
  "Land deiner Bank": "Country of your bank",
  "Das sieht nicht nach einem Private Key aus. Erwartet wird der Inhalt der .pem-Datei inklusive der BEGIN/END-Zeilen.":
    "That doesn't look like a private key. Paste the contents of the .pem file including the BEGIN/END lines.",
  "Realistische Beispieldaten zum Erkunden des Dashboards": "Realistic sample data to explore the dashboard",
  "Aktiv": "Active",
  "Demo-Daten entfernen": "Remove demo data",
  "Daten & Hosting": "Data & Hosting",
  "Alles bleibt bei dir": "Everything stays with you",
  "Alle Daten liegen in einer SQLite-Datenbank unter /data/achilles.db im Container-Volume. Für Backups genügt es, diese Datei zu sichern. Spotpreise und Wechselkurse kommen von gold-api.com, Yahoo Finance und frankfurter.app — es verlassen keine persönlichen Daten deinen Server.":
    "All data lives in a SQLite database at /data/achilles.db inside the container volume. Backing up that file is all you need. Spot prices and FX rates come from gold-api.com, Yahoo Finance and frankfurter.app — no personal data ever leaves your server.",

  // Updates
  "Updates": "Updates",
  "Aktuell": "Up to date",
  "1 Update verfügbar": "1 update available",
  "{n} Updates verfügbar": "{n} updates available",
  "Installiert": "Installed",
  "unbekannt": "unknown",
  "Neueste": "Latest",
  "Update läuft — der Container wird neu gebaut. Die Seite ist gleich kurz nicht erreichbar; danach einfach neu laden.":
    "Update running — the container is rebuilding. This page will be briefly unavailable; just reload afterwards.",
  "Letztes Update fehlgeschlagen": "Last update failed",
  "Neu seit deiner Version": "New since your version",
  "… und {n} weitere": "… and {n} more",
  "Nach Updates suchen": "Check for updates",
  "Update installieren": "Install update",
  "Starte …": "Starting …",
  "In-App-Updates sind hier nicht eingerichtet. Per Shell aktualisieren:": "In-app updates aren't set up here. Update via shell:",
  "Kopieren": "Copy",
  "Kopiert": "Copied",
  "Update jetzt installieren? Der Container wird neu gebaut und startet neu — deine Daten bleiben erhalten.":
    "Install the update now? The container will rebuild and restart — your data is preserved.",
  "In-App-Updates sind nicht eingerichtet (Control-Verzeichnis fehlt). Bitte per Shell aktualisieren.":
    "In-app updates aren't set up (control directory missing). Please update via shell.",
  "Es läuft bereits ein Update.": "An update is already running.",

  // Setup
  "Willkommen · Welcome": "Willkommen · Welcome",
  "Sprache wählen / Choose your language": "Sprache wählen / Choose your language",
  "Bankanbindung (optional)": "Bank connection (optional)",
  "Application-ID und Private Key aus deinem Enable-Banking-Control-Panel (enablebanking.com).":
    "Application ID and private key from your Enable Banking Control Panel (enablebanking.com).",
  "Du kannst das jederzeit später in den Einstellungen nachholen — oder Kontoauszüge per CSV importieren.":
    "You can do this later in Settings at any time — or import statements via CSV.",
  "Überspringen": "Skip",
  "Weiter": "Continue",
  "Zurück": "Back",
  "Wie möchtest du starten?": "How would you like to start?",
  "Mit Demo-Daten erkunden": "Explore with demo data",
  "Realistische Beispieldaten — jederzeit in den Einstellungen entfernbar.": "Realistic sample data — removable in Settings at any time.",
  "Leer starten": "Start empty",
  "Direkt mit deinen echten Daten loslegen.": "Start right away with your real data.",
  "Los geht's": "Let's go",
  "Einen Moment …": "One moment …",

  // API-Fehlermeldungen (häufigste)
  "Enable-Banking-Zugangsdaten fehlen. Bitte Application-ID und Private Key in den Einstellungen hinterlegen.":
    "Enable Banking credentials missing. Please add the application ID and private key in Settings.",
  "Keine Bankverbindung vorhanden. Bitte zuerst per QR-Code verbinden.": "No bank connection yet. Please connect via QR code first.",
  "Private Key konnte nicht gelesen werden. Erwartet wird der vollständige Inhalt der .pem-Datei inklusive BEGIN/END-Zeilen.":
    "Could not read the private key. Paste the full contents of the .pem file including the BEGIN/END lines.",
  "Die Session enthält keine Konten. Bitte neu verbinden.": "The session contains no accounts. Please reconnect.",
  "Symbol ist bereits auf der Watchlist": "Symbol is already on the watchlist",
};

type TFunc = (key: string, vars?: Record<string, string | number>) => string;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: TFunc };

const I18nContext = createContext<Ctx>({ lang: "de", setLang: () => {}, t: (k) => k });

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let out = lang === "en" ? EN[key] ?? key : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  const apply = useCallback((l: Lang) => {
    setNumberLocale(l === "de" ? "de-DE" : "en-US");
    setLangState(l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("achilles-lang");
    if (stored === "en" || stored === "de") apply(stored);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.language === "en" || s.language === "de") {
          apply(s.language);
          localStorage.setItem("achilles-lang", s.language);
        }
      })
      .catch(() => {});
  }, [apply]);

  const setLang = useCallback(
    (l: Lang) => {
      apply(l);
      localStorage.setItem("achilles-lang", l);
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: l }),
      }).catch(() => {});
    },
    [apply]
  );

  const t = useCallback<TFunc>((key, vars) => translate(lang, key, vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
