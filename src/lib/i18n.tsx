"use client";

/**
 * Leichtgewichtige i18n ohne Bibliothek: Die deutschen UI-Strings sind die Keys,
 * das EN-Wörterbuch übersetzt sie. Fehlende Keys fallen auf Deutsch zurück.
 * Platzhalter wie {n} werden nach der Übersetzung ersetzt.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setDisplayCurrency, setNumberLocale } from "./utils";

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
  "Kredite": "Loans",
  "Immobilien": "Real estate",
  "Unternehmenswert": "Business value",
  "Zu viele Fehlversuche. Bitte {n} Sekunden warten.": "Too many failed attempts. Please wait {n} seconds.",
  "Die Datei ist zu groß — erlaubt sind maximal 20 MB.": "The file is too large — the limit is 20 MB.",
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
  "Vermögensaufteilung": "Asset allocation",
  "abzüglich Schulden": "less debt",
  "Verliehen": "Lent out",
  "Edelmetall-Allokation": "Precious metals allocation",
  "Details →": "Details →",
  "Noch keine Edelmetalle erfasst.": "No precious metals recorded yet.",

  // Transaktionen
  "{n} Buchungen": "{n} entries",
  "Händler oder Beschreibung suchen …": "Search merchant or description …",
  "Alle Kategorien": "All categories",
  "Alle Monate": "All months",
  "Alle Konten": "All accounts",
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
  "Einstand / g": "Cost / g",
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
  "CSV importieren": "Import CSV",
  "CSV importiert": "CSV imported",
  "Import fehlgeschlagen": "Import failed",
  "Orderliste erkannt — Käufe und Verkäufe wurden zu Positionen verrechnet.":
    "Order list detected — buys and sells were netted into positions.",
  "Bestandsliste erkannt.": "Holdings list detected.",
  "neu": "new",
  "aktualisiert": "updated",
  "übersprungen": "skipped",
  "Kursdetails und Verlauf": "Price details and history",
  "heute": "today",
  "Auf der Watchlist seit": "On the watchlist since",
  "Seit Aufnahme": "Since added",
  "Kurs von": "Price as of",
  "(veraltet)": "(stale)",
  "Kein Verlauf für diesen Zeitraum verfügbar.": "No history available for this range.",
  "Erkannte Spalten": "Detected columns",
  "Externe Dienste": "External services",
  "{n} Dienste · was abgerufen wird und was dabei rausgeht": "{n} services · what is called and what leaves your server",
  "Ansehen": "View",
  "Jede Verbindung, die Achilles von sich aus nach außen aufbaut — vollständig. Alles andere bleibt auf deinem Server.":
    "Every connection Achilles makes on its own — the complete list. Everything else stays on your server.",
  "nur bei Nutzung": "only when used",
  "immer": "always",
  "Sendet:": "Sends:",
  "Wann:": "When:",
  "Datenschutzerklärung": "Privacy policy",
  "Kurse und Wechselkurse werden ohne Anmeldung abgerufen — die Dienste sehen die IP deines Servers und das abgefragte Symbol, sonst nichts. Achilles sendet keine Telemetrie und bindet keine Skripte, Schriften oder Zählpixel von Dritten ein.":
    "Prices and FX rates are fetched unauthenticated — those services see your server's IP and the symbol requested, nothing else. Achilles sends no telemetry and embeds no third-party scripts, fonts or tracking pixels.",
  "Depot abrufen": "Fetch portfolio",
  "{n} Depot(s) über FinTS abgerufen.": "Fetched {n} portfolio account(s) via FinTS.",
  "Für {n} keinen Einstandskurs erhalten — als Platzhalter steht dort der aktuelle Kurs, die Wertentwicklung zeigt deshalb 0 %. Bitte den echten Kaufkurs nachtragen.":
    "No cost basis was supplied for {n} — the current price stands in as a placeholder, so performance reads 0 %. Please enter the actual purchase price.",
  "Die FinTS-Integration ist nicht aktiviert oder nicht vollständig eingerichtet. Siehe Einstellungen → Integrationen.":
    "The FinTS integration is not enabled or not fully configured. See Settings → Integrations.",
  "Diese Bank bietet über FinTS keine Depotaufstellung an (der Geschäftsvorfall HKWPD fehlt in ihren Angaben). Depotbestände lassen sich hier nur per CSV-Import oder von Hand pflegen.":
    "This bank does not offer a portfolio statement over FinTS (it does not advertise the HKWPD transaction). Holdings can only be added here by CSV import or by hand.",
  "Es wurde kein Depot mit Beständen gefunden.": "No portfolio account with holdings was found.",
  "Der Depotabruf ist fehlgeschlagen.": "Fetching the portfolio failed.",
  "{sym} sind WKN oder ISIN. Der Kursabruf läuft über Yahoo Finance, das nur Kürzel kennt — „Kurse aktualisieren“ lässt diese Positionen aus. Trage das Yahoo-Symbol nach (z. B. AAPL statt 865985).":
    "{sym} are WKN or ISIN identifiers. Price lookups go through Yahoo Finance, which only knows tickers — “Refresh prices” will skip these positions. Add the Yahoo symbol (e.g. AAPL instead of 865985).",
  "Beträge in {cur} wurden zum heutigen Kurs in Euro umgerechnet. Für aktuelle Kurse stimmt das — der Einstand eines älteren Kaufs wird dadurch aber falsch, weil im Export kein historischer Wechselkurs steht. Prüfe diese Positionen.":
    "Amounts in {cur} were converted to euros at today's rate. That is right for current prices — but it makes the cost basis of an older purchase wrong, because the export contains no historical rate. Check those positions.",
  "In der Datei wurde keine Kopfzeile für ein Depot gefunden. Erwartet werden eine Stückzahl-Spalte („Anzahl“/„Quantity“) und eine Kennung („Symbol“/„ISIN“/„Bezeichnung“).":
    "No portfolio header row was found in the file. Expected a quantity column (\u201cAnzahl\u201d/\u201cQuantity\u201d) and an identifier (\u201cSymbol\u201d/\u201cISIN\u201d/\u201cName\u201d).",
  "Die Datei wurde gelesen, aber es bleibt kein Bestand übrig — alle enthaltenen Positionen sind vollständig verkauft.":
    "The file was read, but no holdings remain — every position in it has been sold in full.",
  "Es konnte keine einzige Position gelesen werden — Stückzahl- oder Kursspalte passen nicht.":
    "Not a single position could be read — the quantity or price column does not match.",
  "Watchlist": "Watchlist",

  // Unternehmenswert
  "Eine Orientierungs-Bandbreite für dein eigenes Unternehmen oder einen Kaufkandidaten — nach dem Multiplikatorverfahren, wie es im Mittelstand üblich ist.":
    "An orientation range for your own company or an acquisition target, using the market multiple method common for mid-sized businesses.",
  "Methode": "Method",
  "Zahlen": "Figures",
  "Jahresumsatz (€)": "Annual revenue (€)",
  "EBITDA bereinigt (€)": "Adjusted EBITDA (€)",
  "Vermögen (€)": "Assets (€)",
  "Nettoverschuldung (€)": "Net debt (€)",
  "Bereinigt heißt: ein marktübliches Geschäftsführergehalt ist abgezogen, private und einmalige Posten sind heraus. Nettoverschuldung = Schulden minus Kasse; sie mindert, was beim Verkauf bei dir ankommt.":
    "Adjusted means: a market-rate manager's salary is deducted and private or one-off items are removed. Net debt = debt minus cash; it reduces what actually reaches you on a sale.",
  "Läuft es ohne dich?": "Does it run without you?",
  "Das ist bei kleinen Unternehmen der größte Werthebel — größer als die Branche.":
    "For a small business this is the biggest lever on value — bigger than the industry.",
  "Ohne dich läuft …": "Without you …",
  "gar nichts — alles hängt an mir": "nothing runs — it all depends on me",
  "wenig — ich bin täglich nötig": "little — I am needed daily",
  "einiges — für Wochen ginge es": "much of it — it would cope for weeks",
  "alles — Führung ist eingesetzt": "everything — management is in place",
  "Mitarbeitende": "Employees",
  "keine — Einzelunternehmen": "none — sole operator",
  "Größter Kunde": "Largest customer",
  "über 50 % vom Umsatz": "over 50 % of revenue",
  "20–50 %": "20–50 %",
  "unter 20 %": "under 20 %",
  "Wiederkehrende Umsätze": "Recurring revenue",
  "kaum — Projektgeschäft": "little — project work",
  "teilweise": "partly",
  "überwiegend — Verträge, Abos": "mostly — contracts, subscriptions",
  "Entwicklung": "Trend",
  "rückläufig": "declining",
  "stabil": "flat",
  "wachsend": "growing",
  "Übergabefähigkeit": "Transferability",
  "2. Ebene": "2nd level",
  "Prozesse dok.": "Processes doc.",
  "Ergebnis": "Result",
  "Trage Umsatz und bereinigtes EBITDA ein — ohne Ertrag lässt sich kein Ertragswert bilden.":
    "Enter revenue and adjusted EBITDA — without earnings there is no earnings-based value.",
  "Bandbreite (Eigenkapitalwert)": "Range (equity value)",
  "Mittelwert {mid} · {mult}× EBITDA": "Midpoint {mid} · {mult}× EBITDA",
  "Ohne dich läuft nichts, und es gibt niemanden, der übernehmen könnte. Für einen Käufer ist der Ertrag dann nicht übertragbar — realistisch verkaufst du eher die Substanz als das Unternehmen. Wer den Wert heben will, fängt genau hier an: jemanden aufbauen, Prozesse dokumentieren.":
    "Nothing runs without you, and there is nobody who could take over. For a buyer the earnings are then not transferable — realistically you would be selling the substance, not the business. Raising the value starts exactly here: build someone up, document the processes.",
  "Der Ertragswert liegt unter dem Substanzwert von {v}. Ein Käufer zahlt kaum weniger als das, was er beim Weiterverkauf der Vermögenswerte bekäme.":
    "The earnings value is below the asset value of {v}. A buyer will rarely pay less than what reselling the assets would return.",
  "Was den Multiplikator bewegt": "What moves the multiple",
  "Inhaberabhängigkeit": "Owner dependency",
  "Zweite Führungsebene": "Second management level",
  "Kundenkonzentration": "Customer concentration",
  "Dokumentierte Prozesse": "Documented processes",
  "Größenklasse": "Size class",
  "Speichern als": "Save as",
  "Meine GmbH": "My company",
  "eigenes": "own",
  "Kaufkandidat": "target",
  "inhabergebunden": "owner-bound",
  "Bearbeiten": "Edit",
  "{mult}× EBITDA · erfasst {date}": "{mult}× EBITDA · recorded {date}",
  "Bearbeiten abbrechen": "Cancel editing",
  "Wie gerechnet wird": "How it is calculated",
  "Multiplikatorverfahren: bereinigtes EBITDA × Multiplikator, abzüglich Nettoverschuldung. Der Multiplikator startet beim Branchendurchschnitt und wird durch deine Antworten angepasst.":
    "Market multiple method: adjusted EBITDA × multiple, less net debt. The multiple starts at the industry average and is adjusted by your answers.",
  "Der Ausgangswert von {m}× ist der branchenübergreifende Mittelstands-Durchschnitt (DUB KMU-Multiples Q1/2026); der übliche Korridor liegt bei 4,1–7,3×.":
    "The starting point of {m}× is the cross-industry mid-market average (DUB KMU multiples Q1/2026); the usual corridor is 4.1–7.3×.",
  "Kleinstunternehmen erzielen 30–50 % niedrigere Multiplikatoren als größere Betriebe derselben Branche — das ist als Größenabschlag hinterlegt.":
    "Micro businesses achieve 30–50 % lower multiples than larger firms in the same industry — that is built in as a size discount.",
  "Die Inhaberabhängigkeit wiegt am schwersten. Der AWH-Standard des Handwerks bildet sie mit Kapitalisierungszinsen von 15–25 % ab, was Multiplikatoren von nur 4–6,7× entspricht — noch bevor andere Risiken einfließen.":
    "Owner dependency weighs heaviest. The German AWH standard for craft businesses reflects it with capitalisation rates of 15–25 %, equivalent to multiples of only 4–6.7× before any other risk is considered.",
  "Das ist eine Orientierung, kein Gutachten und keine Anlageberatung. Ein tatsächlicher Preis hängt von Verhandlung, Käufertyp, Finanzierung und Due Diligence ab. Für eine belastbare Bewertung — etwa für Nachfolge, Finanzierung oder Steuer — brauchst du eine Fachperson.":
    "This is an orientation, not an appraisal and not investment advice. An actual price depends on negotiation, buyer type, financing and due diligence. For a defensible valuation — for succession, financing or tax — you need a professional.",
  "„{name}“ löschen?": "Delete {name}?",
  "Eingaben fehlen": "Inputs are missing",

  // Immobilien
  "Adresse, Wert und Fotos — der Wert wird von Hand gepflegt.": "Address, value and photos — the value is maintained by hand.",
  "{n} Objekte": "{n} properties",
  "Immobilie erfassen": "Add a property",
  "Den Wert trägst du selbst ein — eine automatische Marktbewertung bräuchte einen kostenpflichtigen Dienst, und amtliche Bodenrichtwerte bewerten nur den Boden, nicht das Gebäude. Notiere daher, woher deine Zahl stammt.":
    "You enter the value yourself — an automated market valuation would need a paid service, and official land values price only the land, not the building. So record where your figure came from.",
  "Bezeichnung": "Name",
  "Wohnung Berlin": "Flat in Berlin",
  "Adresse (optional)": "Address (optional)",
  "Aktueller Wert (€)": "Current value (€)",
  "Woher stammt der Wert?": "Where does the value come from?",
  "Gutachten, Portal, Schätzung …": "Appraisal, listing portal, own estimate …",
  "Kaufpreis (€, optional)": "Purchase price (€, optional)",
  "Kaufdatum (optional)": "Purchase date (optional)",
  "Wohnfläche m² (optional)": "Floor area m² (optional)",
  "Wert vom": "Valued on",
  "Dein Anteil in %": "Your share in %",
  "Gehört dir nur ein Teil, trage ihn hier ein — Wert, Gewinn und Gesamtvermögen zählen dann nur deinen Anteil. 100 % = alleiniges Eigentum.":
    "If you only own part of it, enter that here — value, gain and net worth then count your share only. 100 % = sole ownership.",
  "{share} % von {full}": "{share} % of {full}",
  "Wert vom {date}": "valued {date}",
  "Quelle: {src}": "Source: {src}",
  "seit Kauf": "since purchase",
  "Foto hinzufügen": "Add photo",
  "Foto ansehen": "View photo",
  "Foto löschen": "Delete photo",
  "Foto": "Photo",
  "Wert aktualisieren": "Update value",
  "Ein Immobilienwert altert. Halte fest, wann und woher — das unterscheidet eine gepflegte Zahl von einer geratenen.":
    "A property value ages. Record when and from where — that is what separates a maintained figure from a guessed one.",
  "Noch nichts erfasst. Trage eine Immobilie mit Adresse und Wert ein — Fotos kannst du danach hinzufügen.":
    "Nothing recorded yet. Add a property with its address and value — you can attach photos afterwards.",
  "Lade Immobilien …": "Loading real estate …",
  "„{name}“ mit allen Fotos löschen?": "Delete {name} including every photo?",
  "Bezeichnung erforderlich": "A name is required",
  "Der Wert muss eine Zahl sein.": "The value must be a number.",
  "Nur JPEG-, PNG- oder WebP-Bilder.": "Only JPEG, PNG or WebP images.",
  "Immobilie nicht gefunden": "Property not found",
  "Foto nicht gefunden": "Photo not found",
  "Automatischer Abruf": "Automatic sync",
  "Wie oft Achilles von sich aus bei der Bank nachfragt": "How often Achilles asks your bank on its own",
  "alle 6 Std.": "every 6 h",
  "alle 12 Std.": "every 12 h",
  "täglich": "daily",
  "wöchentlich": "weekly",
  "nur manuell": "manual only",
  "Kürzer als 6 Stunden gibt es bewusst nicht: PSD2 erlaubt höchstens vier unbeaufsichtigte Abrufe pro Tag und Konto, und einzelne Banken deckeln strenger. Achilles hält sich auch dann daran, wenn die Einstellung anders gesetzt würde. Unabhängig davon läuft deine Bank-Zustimmung nach 90 Tagen ab und muss neu erteilt werden — „Jetzt syncen“ auf der Verbinden-Seite geht jederzeit.":
    "Nothing shorter than 6 hours is offered, on purpose: PSD2 permits at most four unattended accesses per day per account, and individual banks cap it lower. Achilles holds to that even if the setting said otherwise. Separately, your bank consent expires after 90 days and must be granted again — \"Sync now\" on the Connect page works at any time.",
  "Zuletzt automatisch: {date}": "Last automatic run: {date}",
  "Nächster Lauf: {date}": "Next run: {date}",
  "Unternehmen im Gesamtvermögen": "Businesses in net worth",
  "Nur als „eigenes“ erfasste Firmen — Kaufkandidaten nie": "Only entries marked as your own — never purchase targets",
  "Unterer Wert (Empfehlung)": "Lower bound (recommended)",
  "Der Rechner liefert eine Bandbreite, keinen Punktwert. Das untere Ende ist die vorsichtige Wahl — ein Unternehmen ist das mit Abstand illiquideste hier, und ein zu hoch angesetzter Wert schönt jede Kennzahl, die darauf aufbaut.":
    "The calculator gives a range, not a point value. The lower end is the cautious choice — a business is by far the least liquid thing here, and an inflated figure flatters every metric built on it.",
  "Mittelwert": "Midpoint",
  "Die Mitte der Bandbreite. Näher an dem, was ein Verkauf realistisch bringen könnte — aber eben auch nur eine Schätzung, deren Spanne von 1× bis 7× EBITDA reicht.":
    "The middle of the range. Closer to what a sale might realistically fetch — but still an estimate whose span runs from 1× to 7× EBITDA.",
  "Bewertungen bleiben eine eigene Seite. Sinnvoll, solange dein Unternehmen inhabergebunden ist: Dann ist der Ertragswert ohnehin nicht das, was ein Käufer zahlt.":
    "Valuations stay on their own page. Sensible while your business is owner-bound: the earnings value is then not what a buyer would pay anyway.",
  "Unternehmen": "Businesses",
  "Immobilien im Gesamtvermögen": "Real estate in net worth",
  "Ob erfasste Objekte mitzählen": "Whether recorded properties count",
  "Mitzählen": "Count it",
  "Eine Immobilie, die dir gehört, ist ein Vermögenswert — anders als verliehenes Geld hältst du sie selbst. Beachte: Eine Hypothek darauf führst du unter Kredite; ob sie abgezogen wird, entscheidet die Einstellung dort.":
    "A property you own is an asset you hold yourself, unlike money lent out. Note: a mortgage against it lives under Loans, and whether it is subtracted is decided by the setting there.",
  "Nicht mitzählen": "Leave it out",
  "Immobilien bleiben eine eigene Seite. Sinnvoll, wenn dein Wert eine grobe Schätzung ist und du das Gesamtvermögen nicht darauf stützen willst — eine Immobilie ist zudem nicht kurzfristig zu Geld zu machen.":
    "Real estate stays on its own page. Sensible if your figure is a rough estimate and you would rather not rest your net worth on it — a property also cannot be turned into cash quickly.",

  // Kredite
  "Verliehenes und Aufgenommenes — Zahlungen von Hand erfasst.": "Money you lent out and money you took on — payments entered by hand.",
  "Kredit erfassen": "Add a loan",
  "Zinsen laufen taggenau auf den jeweiligen Restbetrag. Eine Zahlung tilgt erst die aufgelaufenen Zinsen, dann das Kapital. Ohne Zinssatz wird nur getilgt.":
    "Interest accrues daily on the balance still outstanding. A payment first covers the interest accrued so far, and the remainder repays the principal. With no rate, payments only repay principal.",
  "Richtung": "Direction",
  "Ich habe verliehen": "I lent it out",
  "Ich habe aufgenommen": "I took it on",
  "An wen": "To whom",
  "Bei wem": "From whom",
  "Art": "Type",
  "Privat": "Private",
  "Bank": "Bank",
  "Summe (€)": "Amount (€)",
  "Zinssatz % p. a. (leer = zinslos)": "Interest % p.a. (blank = none)",
  "Beginn": "Start",
  "Fällig bis (optional)": "Due by (optional)",
  "Verliehen · offen": "Lent out · outstanding",
  "Aufgenommen · offen": "Taken on · outstanding",
  "Alle": "All",
  "Aufgenommen": "Taken on",
  "verliehen": "lent out",
  "aufgenommen": "taken on",
  "zinslos": "interest-free",
  "abgeschlossen": "closed",
  "Abschließen": "Close",
  "Wieder öffnen": "Reopen",
  "Offen": "Outstanding",
  "von {amount}": "of {amount}",
  "+{amount} Zinsen": "+{amount} interest",
  "{amount} getilgt": "{amount} repaid",
  "{amount} mehr gezahlt als geschuldet": "{amount} paid beyond what was owed",
  "fällig {date}": "due {date}",
  "überfällig": "overdue",
  "{n} Zahlungen": "{n} payments",
  "1 Zahlung": "1 payment",
  "Zahlungen · {name}": "Payments · {name}",
  "Jede Zahlung deckt zuerst die bis dahin aufgelaufenen Zinsen, der Rest tilgt das Kapital.":
    "Each payment first covers the interest accrued up to that date; the remainder repays the principal.",
  "Zinslos — jede Zahlung tilgt vollständig das Kapital.": "Interest-free — every payment goes entirely towards the principal.",
  "Betrag (€)": "Amount (€)",
  "Am": "On",
  "Erfassen": "Add",
  "davon Zinsen bezahlt": "of which interest paid",
  "Noch nichts erfasst. Trage einen Kredit ein, den du vergeben oder aufgenommen hast — mit oder ohne Zinsen.":
    "Nothing recorded yet. Add a loan you have given or taken on — with or without interest.",
  "Lade Kredite …": "Loading loans …",
  "Kredit „{name}“ mit allen Zahlungen löschen?": "Delete the loan with {name}, including every payment?",
  "Die Summe muss größer als 0 sein.": "The amount must be greater than 0.",
  "Der Betrag muss größer als 0 sein.": "The amount must be greater than 0.",
  "Name erforderlich": "A name is required",
  "Kredit nicht gefunden": "Loan not found",
  "Live-Kurse via Yahoo Finance · 5-Minuten-Cache": "Live prices via Yahoo Finance · 5-minute cache",
  "Symbol, z. B. NVDA, VWCE.DE": "Symbol, e.g. NVDA, VWCE.DE",
  "Hinzufügen": "Add",
  "Prüfe …": "Checking …",
  "Noch leer — füge Symbole hinzu, um Kurse zu beobachten (Yahoo-Format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).":
    "Empty — add symbols to watch prices (Yahoo format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).",
  "Entfernen": "Remove",
  "Anpinnen": "Pin to top",
  "Ziehen zum Tauschen": "Drag to swap",
  "Nicht mehr anpinnen": "Unpin",
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
  "Auszug": "Statement",
  "1 Vertrag": "1 contract",
  "{n} Verträge": "{n} contracts",
  "Vertrag anlegen": "Add contract",
  "Vertrag bearbeiten": "Edit contract",
  "Vertrag löschen": "Delete contract",
  "Vertrag samt allen Auszügen löschen?": "Delete this contract and all its statements?",
  "Alle Verträge": "All contracts",
  "Lebensversicherung": "Life insurance",
  "davon Wertzuwachs": "of which gain",
  "Standänderung": "Balance change",
  "{pct} auf eingesetztes Kapital": "{pct} on capital invested",
  "mindestens zwei Auszüge nötig": "needs at least two statements",
  "davon {amount} eigene Beiträge": "{amount} of that is your own contributions",
  "{amount}/Monat": "{amount}/month",
  "Renten- und Lebensversicherungen erfassen — die Stände fließen ins Gesamtvermögen und in den FIRE-Simulator ein.": "Track pensions and life insurance — the balances feed into net worth and the FIRE simulator.",
  "Noch kein Vertrag angelegt. Lege deine Altersvorsorge oder Lebensversicherung an und trage danach die Stände aus den Jahresauszügen ein.": "No contract yet. Add your pension or life insurance, then enter the balances from your annual statements.",
  "Jeder Vertrag wird eigenständig geführt — betriebliche und private Altersvorsorge, Lebens- und Rentenversicherungen nebeneinander.": "Each contract is tracked on its own — occupational and private pensions, life and annuity policies side by side.",
  "Datum und Stand vom Auszug übernehmen. Der Beitrag ist das, was seit dem letzten Auszug eingezahlt wurde — nur damit lässt sich der echte Wertzuwachs vom eigenen Geld trennen.": "Take the date and balance from your statement. The contribution is what you paid in since the last one — it is the only way to separate real growth from your own money.",
  "Alle Zahlen stammen aus den Auszügen, die du erfasst hast. Es sind keine Tageswerte, sondern Stände zu deinen Stichtagen.": "All figures come from the statements you entered. These are not daily values but balances on your reporting dates.",
  "die Differenz zwischen erstem und letztem Auszug. Sie enthält deine eigenen Einzahlungen.": "the difference between the first and the latest statement. It includes the money you paid in.",
  "dieselbe Differenz, abzüglich der Beiträge seit dem ersten Auszug. Nur das hat der Vertrag tatsächlich erwirtschaftet.": "the same difference, minus the contributions made since the first statement. That is what the contract actually earned.",
  "Die Prozentangabe bezieht sich auf das eingesetzte Kapital (erster Stand plus spätere Einzahlungen). Bewusst keine zeitgewichtete Rendite: Jahresauszüge liegen zu weit auseinander, um eine solche ehrlich zu berechnen.": "The percentage refers to the capital invested (first balance plus later contributions). Deliberately not a time-weighted return: annual statements are too far apart to compute one honestly.",
  "Vertrag erforderlich": "Contract required",
  "Vertrag nicht gefunden": "Contract not found",
  "Datum und Stand sind erforderlich": "Date and balance are required",
  "Name, Symbol oder ISIN — z. B. VWCE.DE oder IE00BK5BQT80": "Name, symbol or ISIN — e.g. VWCE.DE or IE00BK5BQT80",
  "ISIN erkannt — handelbare Börsenplätze zuerst": "ISIN recognised — tradable venues first",
  "Nichts gefunden": "No matches",
  "Noch leer — suche nach Name, Symbol oder ISIN, um Kurse zu beobachten.": "Empty — search by name, symbol or ISIN to start tracking prices.",
  "Suche nicht erreichbar": "Search unavailable",
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
  "Veränderung heute": "Change today",
  "kein Einstandskurs erfasst": "no entry price recorded",
  "6 Monate": "6 months",
  "Lade Verlauf …": "Loading history …",
  "Kein Verlauf verfügbar": "No history available",

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
  "Währung": "Currency",
  "Kredite im Gesamtvermögen": "Loans in net worth",
  "Ob Verliehenes und Aufgenommenes mitzählen": "Whether money lent out and taken on counts",
  "Nicht einbeziehen": "Leave them out",
  "Kredite bleiben eine eigene Seite. Verliehenes ist Geld, das ein anderer gerade hat — ob es zurückkommt, weiß man erst hinterher. Aber Vorsicht: Ein Bankkredit erhöht dein Vermögen, solange das Geld noch auf dem Konto liegt.":
    "Loans stay on their own page. Money lent out is money someone else is holding — whether it comes back is only known afterwards. But note the flip side: a bank loan raises your net worth for as long as the cash sits in your account.",
  "Nur Schulden abziehen": "Subtract debts only",
  "Durchgehend vorsichtig: Was du schuldest, zählt sicher — was du bekommen sollst, vielleicht. Aufgenommene Kredite werden abgezogen, Verliehenes bleibt draußen.":
    "Cautious throughout: what you owe is certain, what you are owed is not. Loans you took on are subtracted; money you lent out stays out.",
  "Beides einbeziehen": "Include both",
  "Die bilanzielle Sicht: Forderungen zählen, Verbindlichkeiten werden abgezogen. Vermögen minus Schulden — so würde eine Bilanz es sehen.":
    "The balance-sheet view: claims count, liabilities are subtracted. Assets minus debts — the way a balance sheet would see it.",
  "Anzeigewährung · USD wird immer zusätzlich gezeigt": "Display currency · USD always shown alongside",
  "Gespeichert wird weiterhin in Euro — umgerechnet wird erst bei der Anzeige, mit EZB-Referenzkursen (frankfurter.dev, täglich). Eingabefelder für Kaufpreise und Beträge bleiben deshalb in Euro.":
    "Everything is still stored in euros — conversion happens at display time only, using ECB reference rates (frankfurter.dev, updated daily). Input fields for purchase prices and amounts therefore stay in euros.",
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
  "Alle Daten liegen in einer SQLite-Datenbank unter /data/achilles.db im Container-Volume. Für Backups genügt es, diese Datei zu sichern. Spotpreise und Wechselkurse kommen von gold-api.com, Yahoo Finance und frankfurter.dev — es verlassen keine persönlichen Daten deinen Server.":
    "All data lives in a SQLite database at /data/achilles.db inside the container volume. Backing up that file is all you need. Spot prices and FX rates come from gold-api.com, Yahoo Finance and frankfurter.dev — no personal data ever leaves your server.",

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
  "Für diese Version sind keine Patchnotes hinterlegt (Tag ohne Release).":
    "No patch notes are published for this version (tag without a release).",
  "Änderungen auf GitHub ansehen": "View the changes on GitHub",
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
type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
  /** Aktive Anzeigewährung; Beträge selbst bleiben intern EUR. */
  currency: string;
  setCurrency: (code: string) => void;
};

const I18nContext = createContext<Ctx>({
  lang: "de",
  setLang: () => {},
  t: (k) => k,
  currency: "EUR",
  setCurrency: () => {},
});

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let out = lang === "en" ? EN[key] ?? key : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  const [currency, setCurrencyState] = useState("EUR");

  const apply = useCallback((l: Lang) => {
    setNumberLocale(l === "de" ? "de-DE" : "en-US");
    setLangState(l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  /**
   * Kurse holen und im Formatter hinterlegen. Der State-Wechsel danach ist
   * nötig, damit die Oberfläche neu rendert — setDisplayCurrency allein ändert
   * nur ein Modul-Objekt, davon erfährt React nichts.
   */
  const loadFx = useCallback(async () => {
    try {
      const fx = await fetch("/api/fx").then((r) => r.json());
      setDisplayCurrency(fx.currency, fx.rate, fx.usdRate);
      setCurrencyState(fx.currency);
    } catch {
      // Ohne Kurse bleibt es bei EUR — besser als leere Beträge
    }
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
    loadFx();
  }, [apply, loadFx]);

  const setCurrency = useCallback(
    async (code: string) => {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_currency: code }),
      }).catch(() => {});
      await loadFx();
    },
    [loadFx]
  );

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

  return (
    <I18nContext.Provider value={{ lang, setLang, t, currency, setCurrency }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
