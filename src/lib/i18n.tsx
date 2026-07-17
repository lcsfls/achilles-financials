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
  "Notgroschen": "Emergency fund",
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
  "diesen Monat": "this month",
  "Sparquote": "Savings rate",
  "von den Einnahmen": "of income",
  "keine Einnahmen erfasst": "no income recorded",
  "Cashflow": "Cash flow",
  "Einnahmen − Ausgaben": "income − spending",
  "Fixkosten": "Fixed costs",
  "Wohnen & Abos": "housing & subscriptions",
  "Ø Ausgaben": "Avg. spending",
  "6-Monats-Schnitt": "6-month average",
  "noch kein voller Monat": "no full month yet",
  "Größte Ausgabe": "Largest expense",
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

  // Watchlist (eigene Seite)
  "Lade Watchlist …": "Loading watchlist …",
  "{n} Werte": "{n} symbols",
  "{n} im Plus": "{n} up",
  "{n} im Minus": "{n} down",
  "Symbol, z. B. NVDA, VWCE.DE, BTC-EUR, ^GSPC": "Symbol, e.g. NVDA, VWCE.DE, BTC-EUR, ^GSPC",

  // Notgroschen
  "Lade Notgroschen …": "Loading emergency fund …",
  "Zweckgebundene Rücklage für den Notfall. Sie wird aus dem FIRE-Startkapital herausgerechnet — dieses Geld soll nicht investiert werden.":
    "Earmarked reserve for emergencies. It's excluded from FIRE starting capital — this money isn't meant to be invested.",
  "Ziel": "Target",
  "kein Ziel gesetzt": "no target set",
  "Reichweite": "Coverage",
  "bei Ø {amount}/Monat": "at avg. {amount}/month",
  "keine Ausgaben erfasst": "no spending recorded",
  "manuell gepflegt": "entered manually",
  "noch nichts erfasst": "nothing recorded yet",
  "Einrichtung": "Setup",
  "Woher der Stand kommt und wie hoch das Ziel ist": "Where the balance comes from and what the target is",
  "Quelle des Stands": "Source of the balance",
  "Betrag selbst eintragen": "Enter the amount yourself",
  "Für Rücklagen, die die App nicht sieht — Tagesgeld bei einer anderen Bank, Bargeld, Bausparer.":
    "For reserves the app can't see — savings at another bank, cash, building society accounts.",
  "Konto zuweisen": "Assign an account",
  "Der Stand kommt automatisch vom Konto und wird aus der Liquidität herausgerechnet.":
    "The balance comes from the account automatically and is excluded from liquidity.",
  "Aktueller Stand (€)": "Current balance (€)",
  "Kein Konto zugewiesen": "No account assigned",
  "Einrichten": "Set up",
  "Notgroschen einrichten": "Set up emergency fund",
  "Weise ein Konto als Notgroschen zu. Es wird dann aus dem FIRE-Startkapital ausgenommen — zweckgebundenes Geld sollte nicht als investierbares Vermögen zählen.":
    "Assign an account as your emergency fund. It's then excluded from FIRE starting capital — earmarked money shouldn't count as investable wealth.",
  "Das gewählte Konto gilt als zweckgebunden und wird aus dem FIRE-Startkapital herausgerechnet.":
    "The selected account counts as earmarked and is excluded from FIRE starting capital.",
  "Konto": "Account",
  "— keines —": "— none —",
  "Noch keine Konten vorhanden — verbinde zuerst eine Bank oder importiere eine CSV.":
    "No accounts yet — connect a bank or import a CSV first.",
  "Monatsausgaben abdecken": "Months of expenses to cover",
  "{n} Monate": "{n} months",
  "Zielbetrag (€)": "Target amount (€)",
  "Vorschlag aus deinen Ausgaben: {amount} ({n} × {monthly}) — übernehmen":
    "Suggested from your spending: {amount} ({n} × {monthly}) — use this",
  "Ziel {amount}": "Target {amount}",
  "Ziel erreicht": "Target reached",
  "Deckt {n} Monate deiner aktuellen Ausgaben": "Covers {n} months of your current spending",
  "Notgroschen ({amount}) ist ausgenommen": "Emergency fund ({amount}) is excluded",

  // Fondsaufteilung Vorsorge
  "Fondsaufteilung": "Fund allocation",
  "Worin deine Vorsorge angelegt ist": "What your pension is invested in",
  "Einzahlungen seit": "Contributing since",
  "Eingezahlt (geschätzt)": "Contributed (estimated)",
  "in {n} Monaten": "over {n} months",
  "Wertzuwachs": "gain",
  "Guthaben": "Balance",
  "ETF-Symbol (Yahoo-Format)": "ETF symbol (Yahoo format)",
  "Gewicht %": "Weight %",
  "Noch {n} % nicht zugeordnet.": "{n} % still unallocated.",
  "Gewichtung übersteigt 100 %.": "Weights exceed 100 %.",
  "Trage die Fonds deiner Vorsorge mit ihrer Gewichtung ein — der Anteil am Guthaben und die Live-Kurse erscheinen dann hier.":
    "Add the funds your pension holds with their weights — their share of the balance and live prices appear here.",

  // FIRE
  "FIRE-Simulator": "FIRE Simulator",
  "Financial Independence, Retire Early — alle Werte inflationsbereinigt in heutiger Kaufkraft.":
    "Financial Independence, Retire Early — all values inflation-adjusted in today's purchasing power.",
  "Szenario anlegen": "New scenario",
  "Szenario bearbeiten": "Edit scenario",
  "Neues Szenario": "New scenario",
  "Szenario wirklich löschen?": "Really delete this scenario?",
  "Das letzte Szenario kann nicht gelöscht werden.": "The last scenario can't be deleted.",
  "Parameter anpassen — die Vorschau rechnet live mit.": "Adjust the parameters — the preview updates live.",
  "z. B. Optimistisch, Sparsam, Basis": "e.g. Optimistic, Frugal, Base",
  "Bearbeiten": "Edit",
  "Abbrechen": "Cancel",
  "Welches Vermögen zählt ins Startkapital?": "Which assets count toward starting capital?",
  "Summe Startkapital": "Starting capital total",
  "aus gewählten Bausteinen": "from selected assets",
  "Welche Bausteine zählen, legst du je Szenario fest — über „Bearbeiten“.":
    "Which assets count is set per scenario — via “Edit”.",
  "Realrendite": "Real return",
  "nach Inflation": "after inflation",
  "FIRE-Zahl {amount}": "FIRE number {amount}",
  "Mon.": "mo",
  "Rendite": "return",
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
  "{n} weitere ausgeblendet — tippe oben, um zu suchen.": "{n} more hidden — type above to search.",
  "Diese Bank ist in {country} lizenziert und dort gelistet — auch wenn deine IBAN aus einem anderen Land stammt. Zum Wechseln hier klicken.":
    "This bank is licensed in {country} and listed there — even if your IBAN is from another country. Click here to switch.",
  "Diese Liste kommt aus der Sandbox-Umgebung — echte Banken wie Revolut fehlen dort. Registriere im Control Panel eine Anwendung in der Produktionsumgebung (Sandbox-Apps lassen sich nicht umstellen).":
    "This list comes from the sandbox environment — real banks like Revolut aren't in it. Register an application in the production environment in the Control Panel (sandbox apps can't be switched over).",
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
  "Benutzername": "Username",
  "Login": "Login",
  "Schützt das Dashboard mit Benutzername und Passwort": "Protects the dashboard with a username and password",
  "Kein Schutz": "Unprotected",
  "Ohne Login kann jeder im Netzwerk deine Finanzdaten sehen und deine Bank-Zugangsdaten auslesen.":
    "Without a login, anyone on your network can see your finances and read your banking credentials.",
  "Neues Passwort": "New password",
  "Aktuelles Passwort": "Current password",
  "mindestens 8 Zeichen": "at least 8 characters",
  "Zugangsdaten ändern": "Change credentials",
  "Login aktivieren": "Enable login",
  "Login deaktivieren": "Disable login",
  "Abmelden": "Sign out",
  "Aktuelles Passwort ist falsch.": "Current password is incorrect.",
  "Das Passwort muss mindestens 8 Zeichen haben.": "The password must be at least 8 characters.",
  "Benutzername und Passwort erforderlich": "Username and password required",
  "Passkeys sind noch nicht umgesetzt — bis dahin schützt das Passwort. Für Zugriff von außerhalb des LAN gehört ohnehin ein Reverse-Proxy mit HTTPS davor.":
    "Passkeys aren't implemented yet — the password protects you until then. For access from outside your LAN you want a reverse proxy with HTTPS in front anyway.",
  "Passwort": "Password",
  "Anmelden": "Sign in",
  "Anmelden …": "Signing in …",
  "Benutzername oder Passwort ist falsch.": "Incorrect username or password.",
  "Passwort vergessen? Es lässt sich nur direkt in der Datenbank zurücksetzen — siehe README.":
    "Forgot your password? It can only be reset directly in the database — see the README.",
  "Sprache der Oberfläche und Zahlenformate": "Interface language and number formats",
  "PSD2-Schnittstelle zu 2.700+ Banken in Europa": "PSD2 interface to 2,700+ banks across Europe",
  "Konfiguriert": "Configured",
  "Nicht konfiguriert": "Not configured",
  "Account anlegen unter": "Create an account at",
  "im Control Panel eine Anwendung registrieren (Redirect-URL siehe unten) und den dabei erzeugten Private Key hier einfügen. Application-ID und Key bleiben ausschließlich in deiner lokalen SQLite-Datenbank.":
    "register an application in the Control Panel (redirect URL below) and paste the private key it generates here. The application ID and key never leave your local SQLite database.",
  "Redirect-URL für das Control Panel": "Redirect URL for the Control Panel",
  "Öffentliche Adresse dieser Instanz": "Public address of this instance",
  "Die Adresse, unter der dein Handy das Dashboard erreicht — hinter einem Reverse-Proxy also die HTTPS-Domain, nicht die interne IP. Enable Banking lehnt http:// in der Produktivumgebung ab.":
    "The address your phone reaches the dashboard at — behind a reverse proxy that's the HTTPS domain, not the internal IP. Enable Banking rejects http:// in production.",
  "Kein HTTPS — Enable Banking wird diese Redirect-URL in der Produktivumgebung ablehnen.":
    "Not HTTPS — Enable Banking will reject this redirect URL in production.",
  "Diese URL stammt {source} und ist kein HTTPS. Trage oben deine HTTPS-Domain ein, sonst wird die Redirect-URL abgelehnt.":
    "This URL comes {source} and isn't HTTPS. Enter your HTTPS domain above, otherwise the redirect URL will be rejected.",
  "aus der APP_URL-Umgebungsvariable": "from the APP_URL environment variable",
  "aus dem aktuellen Aufruf": "from the current request",
  "Keine gültige URL. Erwartet wird z. B. https://achilles.deine-domain.de":
    "Not a valid URL. Expected something like https://achilles.your-domain.com",
  "Bitte nur die Basis-Adresse angeben, ohne Pfad.": "Enter just the base address, without a path.",
  "Nur http:// oder https:// sind erlaubt.": "Only http:// or https:// are allowed.",
  "Private Key (.pem-Inhalt)": "Private key (.pem contents)",
  "Land deiner Bank": "Country of your bank",
  "Das sieht nicht nach einem Private Key aus. Erwartet wird der Inhalt der .pem-Datei inklusive der BEGIN/END-Zeilen.":
    "That doesn't look like a private key. Paste the contents of the .pem file including the BEGIN/END lines.",
  "Realistische Beispieldaten zum Erkunden des Dashboards": "Realistic sample data to explore the dashboard",
  "Aktiv": "Active",
  "Demo-Daten entfernen": "Remove demo data",
  "Demo-Daten laden?": "Load demo data?",
  "Demo-Daten landen in derselben Datenbank wie deine echten Daten — nicht in einem getrennten Modus.":
    "Demo data goes into the same database as your real data — it is not a separate mode.",
  "Du hast bereits {n} echtes Konto verbunden.": "You already have {n} real account(s) connected.",
  "Die Demo-Buchungen mischen sich in deine Transaktionsliste und verfälschen Auswertungen wie Sparquote und Kategorien.":
    "Demo transactions will mix into your transaction list and skew figures like savings rate and categories.",
  "Was passiert": "What happens",
  "Ein Demo-Konto und rund 300 Buchungen aus 8 Monaten werden angelegt.":
    "A demo account and roughly 300 transactions across 8 months are created.",
  "Edelmetalle, Investments, Vorsorge und FIRE-Szenarien werden nur angelegt, wenn dort noch nichts steht — deine eigenen Einträge bleiben unangetastet.":
    "Precious metals, investments, pension and FIRE scenarios are only added if those are still empty — your own entries are left untouched.",
  "Alles Demo-Erzeugte ist markiert und lässt sich über „Demo-Daten entfernen“ rückstandsfrei löschen.":
    "Everything the demo creates is flagged and can be removed completely via “Remove demo data”.",
  "Trotzdem laden": "Load anyway",
  "Lade …": "Loading …",
  "Backup": "Backup",
  "Verschlüsselte Sicherung aller Daten (.achillesbak)": "Encrypted backup of everything (.achillesbak)",
  "Die Datei enthält alles: Konten, Buchungen, Bestände, Szenarien — und deinen Bank-Private-Key. Sie wird mit AES-256 aus deinem Passwort verschlüsselt. Ohne dieses Passwort ist sie nicht wiederherstellbar; es gibt keine Hintertür.":
    "The file holds everything: accounts, transactions, holdings, scenarios — and your banking private key. It's encrypted with AES-256 derived from your password. Without that password it cannot be restored; there is no back door.",
  "Backup-Passwort": "Backup password",
  "Backup herunterladen": "Download backup",
  "Erstelle …": "Creating …",
  "Backup heruntergeladen: {name}": "Backup downloaded: {name}",
  "Wiederherstellen": "Restore",
  "Datei auswählen": "Choose file",
  "Stelle wieder her …": "Restoring …",
  "Ersetzt alle aktuellen Daten durch den Inhalt des Backups. Nutze oben dasselbe Passwort, mit dem die Datei erstellt wurde.":
    "Replaces all current data with the backup's contents. Use the same password the file was created with.",
  "Wiederherstellen? Alle aktuellen Daten werden durch den Inhalt des Backups ersetzt — auch Login und Bank-Zugangsdaten.":
    "Restore? All current data will be replaced by the backup's contents — including the login and banking credentials.",
  "Wiederhergestellt: {n} Tabellen. Seite wird neu geladen …": "Restored: {n} tables. Reloading …",
  "Das Backup-Passwort muss mindestens 8 Zeichen haben.": "The backup password must be at least 8 characters.",
  "Entschlüsselung fehlgeschlagen — falsches Passwort oder beschädigte Datei.":
    "Decryption failed — wrong password or a corrupted file.",
  "Das ist keine Achilles-Backup-Datei (.achillesbak).": "That is not an Achilles backup file (.achillesbak).",
  "Daten & Hosting": "Data & Hosting",
  "Alles bleibt bei dir": "Everything stays with you",
  "Alle Daten liegen in einer SQLite-Datenbank unter /data/achilles.db im Container-Volume. Für Backups genügt es, diese Datei zu sichern. Spotpreise und Wechselkurse kommen von gold-api.com, Yahoo Finance und frankfurter.app — es verlassen keine persönlichen Daten deinen Server.":
    "All data lives in a SQLite database at /data/achilles.db inside the container volume. Backing up that file is all you need. Spot prices and FX rates come from gold-api.com, Yahoo Finance and frankfurter.app — no personal data ever leaves your server.",

  // Updates
  "Updates": "Updates",
  "Aktuell": "Up to date",
  "Prüfung fehlgeschlagen": "Check failed",
  "Die Version auf GitHub konnte nicht geprüft werden — meist das Stundenlimit der GitHub-API (60 Anfragen ohne Token) oder fehlendes Internet. Später erneut versuchen.":
    "Couldn't check the version on GitHub — usually the API's hourly limit (60 requests without a token) or no internet. Try again later.",
  "1 Update verfügbar": "1 update available",
  "{n} Updates verfügbar": "{n} updates available",
  "Version {v} verfügbar": "Version {v} available",
  "Neu in v{v}": "New in v{v}",
  "Auf v{v} aktualisieren": "Update to v{v}",
  "Alle Versionen →": "All releases →",
  "Installiert": "Installed",
  "unbekannt": "unknown",
  "Neueste": "Latest",
  "Letztes Update fehlgeschlagen": "Last update failed",
  "Neu seit deiner Version": "New since your version",
  "… und {n} weitere": "… and {n} more",
  "Nach Updates suchen": "Check for updates",
  "Update installieren": "Install update",
  "Starte …": "Starting …",
  "In-App-Updates sind hier nicht eingerichtet. Per Shell aktualisieren:": "In-app updates aren't set up here. Update via shell:",
  "Keine Schreibrechte im Control-Verzeichnis — einmalig in der Proxmox-Shell ausführen (kein Container-Passwort nötig):":
    "No write access to the control directory — run this once in the Proxmox shell (no container password needed):",
  "Keine Schreibrechte im Control-Verzeichnis — die Dateien gehören root, die App läuft als uid 1001. Einmalig in der Proxmox-Shell ausführen (<CTID> durch deine Container-ID ersetzen, ein Container-Passwort brauchst du dafür nicht):":
    "No write access to the control directory — the files are owned by root while the app runs as uid 1001. Run this once in the Proxmox shell (replace <CTID> with your container ID; no container password needed):",
  "Kopieren": "Copy",
  "Kopiert": "Copied",
  "Der Container wird neu gebaut und startet neu. Deine Daten bleiben unberührt.":
    "The container will rebuild and restart. Your data is untouched.",
  "Neu": "New",
  "Der Build dauert einige Minuten. Das Dashboard ist zwischendurch kurz nicht erreichbar — dieses Fenster bleibt offen und zeigt den Fortschritt.":
    "The build takes a few minutes. The dashboard will be briefly unreachable — this window stays open and shows the progress.",
  "Jetzt aktualisieren": "Update now",
  "Update läuft": "Update running",
  "Fenster offen lassen — bei laufendem Build ist das normal.": "Leave this window open — that's normal while the build runs.",
  "Version wird geladen": "Fetching version",
  "Container wird gebaut": "Building container",
  "Neustart": "Restarting",
  "Fertig": "Done",
  "Container antwortet gerade nicht — er wird neu gestartet. Das Fenster verbindet sich automatisch wieder.":
    "The container isn't responding — it's restarting. This window will reconnect automatically.",
  "Build-Ausgabe": "Build output",
  "Update abgeschlossen": "Update complete",
  "Seite neu laden": "Reload page",
  "Update fehlgeschlagen": "Update failed",
  "Die alte Version läuft weiter. Vollständiges Log auf dem Host unter control/update.log.":
    "The previous version keeps running. Full log on the host at control/update.log.",
  "Schließen": "Close",
  "Erneut versuchen": "Try again",
  "Fortschritt anzeigen": "Show progress",
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
