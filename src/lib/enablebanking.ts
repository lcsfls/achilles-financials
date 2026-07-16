/**
 * Enable Banking — PSD2-Zugang zu 2.700+ Banken in 30 europäischen Ländern.
 *
 * Kostenloser Zugang für Privatnutzung ("Restricted Production"): echte
 * Produktionsdaten, aber nur von Konten, die du selbst freischaltest — genau
 * der Bedarf eines privaten Dashboards.
 *
 * Einrichtung: Account auf enablebanking.com, Anwendung im Control Panel
 * registrieren, dabei fällt ein RSA-Private-Key (.pem) an. Application-ID und
 * Key werden in den Einstellungen hinterlegt und bleiben in der lokalen SQLite.
 *
 * Auth: pro Request ein RS256-signiertes JWT (kid = Application-ID).
 */
import crypto from "crypto";
import { db, getSetting, setSetting } from "./db";
import { categorize } from "./categorize";

const API = "https://api.enablebanking.com";

export class EbError extends Error {
  constructor(msg: string, public status?: number) {
    super(msg);
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** RS256-JWT ohne externe Abhängigkeit — Node-crypto kann das direkt. */
function makeJwt(): string {
  const appId = getSetting("eb_app_id");
  const key = getSetting("eb_private_key");
  if (!appId || !key) {
    throw new EbError("Enable-Banking-Zugangsdaten fehlen. Bitte Application-ID und Private Key in den Einstellungen hinterlegen.");
  }

  const iat = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const body = { iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;

  let sig: Buffer;
  try {
    sig = crypto.sign("RSA-SHA256", Buffer.from(input), key);
  } catch {
    throw new EbError("Private Key konnte nicht gelesen werden. Erwartet wird der vollständige Inhalt der .pem-Datei inklusive BEGIN/END-Zeilen.");
  }
  return `${input}.${sig.toString("base64url")}`;
}

async function ebFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.message || body?.detail || body?.error || JSON.stringify(body);
    if (res.status === 401 || res.status === 403) {
      throw new EbError(`Zugriff verweigert (${res.status}). Application-ID/Key prüfen — und ob die Anwendung im Control Panel freigeschaltet ist: ${detail}`, res.status);
    }
    throw new EbError(`Enable Banking ${res.status}: ${detail}`, res.status);
  }
  return body;
}

export type Aspsp = {
  name: string;
  country: string;
  logo?: string;
  psu_types?: string[];
  beta?: boolean;
  /** Nur in der Sandbox-Umgebung gesetzt — verrät, dass die App eine Sandbox-App ist. */
  sandbox?: unknown;
};

/**
 * Banken eines Landes — Basis für die Auswahl auf der Verbinden-Seite.
 *
 * Bewusst ohne Filterung: psu_types ist je nach Bank unterschiedlich gepflegt,
 * und eine still fehlende Bank ist deutlich schlimmer als eine zu viel in der
 * Liste. Die Auswahl trifft ohnehin der Nutzer.
 */
export async function listAspsps(country: string): Promise<Aspsp[]> {
  const data = await ebFetch(`/aspsps?country=${encodeURIComponent(country)}`);
  const list: Aspsp[] = data.aspsps ?? [];
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/** Startet die Autorisierung; liefert die URL, die als QR-Code angezeigt wird. */
export async function startAuth(aspspName: string, country: string, redirectUrl: string) {
  const state = crypto.randomUUID();
  // Zugriff so lange gültig, wie die Bank erlaubt (üblich: 90–180 Tage)
  const validUntil = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();

  const data = await ebFetch("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: validUntil },
      aspsp: { name: aspspName, country },
      state,
      redirect_url: redirectUrl,
      psu_type: "personal",
    }),
  });

  setSetting("eb_auth_state", state);
  setSetting("eb_aspsp_name", aspspName);
  setSetting("eb_country", country);
  setSetting("eb_auth_status", "started");
  return { url: data.url as string, authorizationId: data.authorization_id as string };
}

/** Schließt die Autorisierung ab: code → Session + Konten. */
export async function completeAuth(code: string, state?: string) {
  const expected = getSetting("eb_auth_state");
  if (expected && state && expected !== state) {
    throw new EbError("State stimmt nicht überein — Autorisierung abgebrochen.");
  }

  const data = await ebFetch("/sessions", { method: "POST", body: JSON.stringify({ code }) });
  setSetting("eb_session_id", data.session_id);
  setSetting("eb_auth_status", "linked");
  setSetting("eb_linked_at", new Date().toISOString());

  const d = db();
  const upsert = d.prepare(
    `INSERT INTO accounts (id, provider, name, iban, currency, balance, last_synced)
     VALUES (?, 'enablebanking', ?, ?, ?, 0, NULL)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, iban = excluded.iban, currency = excluded.currency`
  );

  type EbAccount = { uid: string; name?: string; product?: string; currency?: string; account_id?: { iban?: string } };
  const accounts: EbAccount[] = data.accounts ?? [];
  for (const a of accounts) {
    upsert.run(a.uid, a.name || a.product || getSetting("eb_aspsp_name") || "Konto", a.account_id?.iban ?? null, a.currency || "EUR");
  }
  return { sessionId: data.session_id as string, accounts: accounts.length };
}

export async function getSessionStatus(): Promise<{ status: string; accounts: number } | null> {
  const sessionId = getSetting("eb_session_id");
  if (!sessionId) return null;
  try {
    const data = await ebFetch(`/sessions/${sessionId}`);
    return { status: data.status ?? "UNKNOWN", accounts: (data.accounts ?? []).length };
  } catch (e) {
    if (e instanceof EbError && e.status === 404) {
      setSetting("eb_auth_status", "expired");
      return { status: "EXPIRED", accounts: 0 };
    }
    throw e;
  }
}

type EbTx = {
  entry_reference?: string;
  transaction_id?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  transaction_amount: { currency: string; amount: string };
  credit_debit_indicator?: string; // CRDT | DBIT
  status?: string; // BOOK | PDNG
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[] | string;
};

/**
 * Enable Banking liefert ISO-20022-Semantik: Betrag immer positiv, Richtung
 * steckt in credit_debit_indicator. Intern rechnen wir mit Vorzeichen.
 */
function signedAmount(t: EbTx): number {
  const raw = Math.abs(Number(t.transaction_amount.amount));
  return t.credit_debit_indicator === "DBIT" ? -raw : raw;
}

function counterparty(t: EbTx): string | null {
  return (t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name) || null;
}

function remittance(t: EbTx): string | null {
  const r = t.remittance_information;
  if (!r) return null;
  return (Array.isArray(r) ? r.join(" ") : r).trim() || null;
}

export async function syncAccounts(): Promise<{ accounts: number; transactions: number }> {
  const sessionId = getSetting("eb_session_id");
  if (!sessionId) throw new EbError("Keine Bankverbindung vorhanden. Bitte zuerst per QR-Code verbinden.");

  const session = await ebFetch(`/sessions/${sessionId}`);
  const uids: string[] = (session.accounts ?? []).map((a: { uid?: string } | string) =>
    typeof a === "string" ? a : a.uid
  );
  if (uids.length === 0) throw new EbError("Die Session enthält keine Konten. Bitte neu verbinden.");

  const d = db();
  let txCount = 0;

  const upsertTx = d.prepare(
    `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       booking_date = excluded.booking_date, amount = excluded.amount, pending = excluded.pending,
       merchant = COALESCE(transactions.merchant, excluded.merchant),
       category = CASE WHEN transactions.category_locked = 1 THEN transactions.category ELSE excluded.category END`
  );

  for (const uid of uids) {
    // Konto + Saldo
    const balances = await ebFetch(`/accounts/${uid}/balances`).catch(() => null);
    const bal =
      balances?.balances?.find((b: { balance_type?: string }) =>
        ["CLBD", "XPCD", "ITAV", "CLAV"].includes(b.balance_type ?? "")
      ) ?? balances?.balances?.[0];

    d.prepare(
      `INSERT INTO accounts (id, provider, name, currency, balance, last_synced)
       VALUES (?, 'enablebanking', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, last_synced = excluded.last_synced`
    ).run(
      uid,
      getSetting("eb_aspsp_name") || "Konto",
      bal?.balance_amount?.currency || "EUR",
      bal ? Number(bal.balance_amount.amount) : 0,
      new Date().toISOString()
    );

    // Transaktionen, seitenweise über continuation_key
    const dateFrom = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    let continuationKey: string | undefined;
    let pages = 0;

    do {
      const params = new URLSearchParams({ date_from: dateFrom });
      if (continuationKey) params.set("continuation_key", continuationKey);

      const page = await ebFetch(`/accounts/${uid}/transactions?${params}`);
      for (const t of (page.transactions ?? []) as EbTx[]) {
        const amount = signedAmount(t);
        const merchant = counterparty(t);
        const desc = remittance(t);
        const date = t.booking_date || t.value_date || t.transaction_date || new Date().toISOString().slice(0, 10);
        const id =
          t.transaction_id ||
          t.entry_reference ||
          `${uid}-${date}-${amount}-${merchant ?? desc ?? ""}`;

        upsertTx.run(
          id, uid, date, amount, t.transaction_amount.currency,
          merchant, desc, categorize(merchant, desc, amount),
          t.status === "PDNG" ? 1 : 0
        );
        txCount++;
      }
      continuationKey = page.continuation_key;
      pages++;
    } while (continuationKey && pages < 50); // Schutz gegen Endlosschleifen
  }

  setSetting("eb_last_sync", new Date().toISOString());
  return { accounts: uids.length, transactions: txCount };
}
