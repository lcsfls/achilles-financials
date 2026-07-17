import { PinTanClient } from "fints-lib";
import { db, getSetting, setSetting } from "./db";
import { categorize } from "./categorize";

/**
 * FinTS/HBCI — Direktanbindung deutscher Banken.
 *
 * Anders als Enable Banking läuft hier kein Browser-Redirect: Der Server
 * spricht unmittelbar mit der Bank. Damit entfallen HTTPS-Domain, Privacy- und
 * Terms-Seiten. Der Preis: nur deutsche Institute, und die Deutsche
 * Kreditwirtschaft verlangt eine Produktregistrierungsnummer (kostenlos, aber
 * mit mehreren Wochen Vorlauf).
 */

export class FinTsError extends Error {
  constructor(msg: string, public needsTan = false) {
    super(msg);
  }
}

type Credentials = { url: string; blz: string; name: string; pin: string; productId?: string };

function credentials(): Credentials {
  const url = getSetting("fints_url");
  const blz = getSetting("fints_blz");
  const name = getSetting("fints_user");
  const pin = getSetting("fints_pin");

  if (!url || !blz || !name || !pin) {
    throw new FinTsError("FinTS ist nicht vollständig konfiguriert — es fehlen Bankleitzahl, Zugangsdaten oder die FinTS-URL.");
  }
  return { url, blz, name, pin, productId: getSetting("fints_product_id") ?? undefined };
}

function client(): PinTanClient {
  const c = credentials();
  return new PinTanClient({
    url: c.url,
    blz: c.blz,
    name: c.name,
    pin: c.pin,
    // Ohne registrierte Produkt-ID antworten viele Banken mit
    // "9050 / 3078 Software nicht als FinTS-Produkt registriert".
    productId: c.productId,
  });
}

/** Übersetzt die typischen Bankfehler in etwas, das weiterhilft. */
function explain(e: unknown): FinTsError {
  const msg = e instanceof Error ? e.message : String(e);

  if (/3078|nicht als FinTS-Produkt registriert|not registered/i.test(msg)) {
    return new FinTsError(
      "Die Bank lehnt die Anfrage ab: Software nicht als FinTS-Produkt registriert. " +
        "Dafür brauchst du eine Produktregistrierungsnummer der Deutschen Kreditwirtschaft (kostenlos über fints.org, Bearbeitung 10–15 Werktage) und trägst sie in den Einstellungen ein."
    );
  }
  if (/9010|9210|PIN|gesperrt|ungültig/i.test(msg)) {
    return new FinTsError("Die Bank hat die Zugangsdaten abgelehnt. Bitte Bankleitzahl, Benutzerkennung und PIN prüfen — mehrere Fehlversuche können den Zugang sperren.");
  }
  if (/TAN|SCA|Zwei|challenge/i.test(msg)) {
    return new FinTsError(
      "Die Bank verlangt eine TAN (starke Kundenauthentifizierung). Der interaktive TAN-Dialog ist noch nicht umgesetzt — siehe Hinweis in den Einstellungen.",
      true
    );
  }
  if (/ENOTFOUND|ECONNREFUSED|certificate|fetch failed/i.test(msg)) {
    return new FinTsError(`Die FinTS-URL ist nicht erreichbar (${msg}). Bitte die Adresse deiner Bank prüfen.`);
  }
  return new FinTsError(`FinTS-Fehler: ${msg}`);
}

export type FinTsAccount = { iban: string | null; accountNumber: string; blz: string; name: string };

/** Verbindung testen und Konten auflisten — ohne etwas zu speichern. */
export async function listAccounts(): Promise<FinTsAccount[]> {
  try {
    const accounts = await client().accounts();
    return accounts.map((a) => ({
      iban: a.iban || null,
      accountNumber: a.accountNumber,
      blz: a.blz,
      name: a.accountOwnerName || a.accountNumber,
    }));
  } catch (e) {
    throw explain(e);
  }
}

/**
 * MT940 liefert das Datum als String, je nach Bank als "YYMMDD" oder bereits
 * ISO. Beides abfangen statt auf ein Format zu wetten.
 */
function toIsoDate(value: string | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{6}$/.test(value)) {
    const yy = Number(value.slice(0, 2));
    const year = yy > 70 ? 1900 + yy : 2000 + yy;
    return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

export async function syncAccounts(): Promise<{ accounts: number; transactions: number }> {
  const c = client();
  const d = db();
  let txCount = 0;

  let accounts;
  try {
    accounts = await c.accounts();
  } catch (e) {
    throw explain(e);
  }

  const upsertTx = d.prepare(
    `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       booking_date = excluded.booking_date, amount = excluded.amount,
       merchant = COALESCE(transactions.merchant, excluded.merchant),
       category = CASE WHEN transactions.category_locked = 1 THEN transactions.category ELSE excluded.category END`
  );

  for (const account of accounts) {
    // Kontonummer + BLZ als stabile ID — die IBAN liefert nicht jede Bank mit
    const accountId = `fints-${account.blz}-${account.accountNumber}`;
    const name = account.accountOwnerName || account.accountNumber;

    let balanceValue = 0;
    let balanceCurrency = "EUR";
    try {
      const balance = await c.balance(account);
      balanceValue = balance.bookedBalance ?? 0;
      balanceCurrency = balance.currency || "EUR";
    } catch {
      // Saldo kann fehlschlagen, Umsätze können trotzdem gehen — nicht abbrechen
    }

    d.prepare(
      `INSERT INTO accounts (id, provider, name, iban, currency, balance, last_synced)
       VALUES (?, 'fints', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, iban = excluded.iban,
         balance = excluded.balance, last_synced = excluded.last_synced`
    ).run(accountId, name, account.iban || null, balanceCurrency, balanceValue, new Date().toISOString());

    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);

    let statements;
    try {
      statements = await c.statements(account, from, new Date());
    } catch (e) {
      throw explain(e);
    }

    for (const statement of statements) {
      for (const tx of statement.transactions) {
        // MT940: isCredit unterscheidet Gutschrift und Lastschrift, der Betrag
        // ist immer positiv — wie bei ISO 20022 muss das Vorzeichen abgeleitet
        // werden, sonst werden Ausgaben zu Einnahmen.
        const amount = tx.isCredit ? Math.abs(tx.amount) : -Math.abs(tx.amount);
        const merchant = tx.descriptionStructured?.name || null;
        // reference ist ein Objekt (PaymentReference), nicht der Text selbst
        const description = tx.descriptionStructured?.reference?.raw || tx.description || null;
        const date = toIsoDate(tx.valueDate || tx.entryDate);
        // tx.id kommt aus MT940 und ist innerhalb des Kontos stabil; nur wenn
        // sie fehlt, aus den Werten einen Schlüssel bilden.
        const id = tx.id
          ? `${accountId}-${tx.id}`
          : `${accountId}-${date}-${amount}-${(merchant ?? description ?? "").slice(0, 40)}`;

        upsertTx.run(id, accountId, date, amount, tx.currency || "EUR", merchant, description, categorize(merchant, description, amount));
        txCount++;
      }
    }
  }

  setSetting("fints_last_sync", new Date().toISOString());
  return { accounts: accounts.length, transactions: txCount };
}
