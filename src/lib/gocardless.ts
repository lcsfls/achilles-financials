/**
 * GoCardless Bank Account Data (ehem. Nordigen) — PSD2-Zugang zu Revolut & 2500+ Banken.
 * Kostenloser Account: https://bankaccountdata.gocardless.com
 * Secret ID + Secret Key werden in den Einstellungen hinterlegt.
 */
import { db, getSetting, setSetting } from "./db";
import { categorize } from "./categorize";

const BASE = "https://bankaccountdata.gocardless.com/api/v2";

class GcError extends Error {
  constructor(msg: string, public status?: number) {
    super(msg);
  }
}

async function gcFetch(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail || body?.summary || JSON.stringify(body);
    throw new GcError(`GoCardless ${res.status}: ${detail}`, res.status);
  }
  return body;
}

async function getAccessToken(): Promise<string> {
  const secretId = getSetting("gc_secret_id");
  const secretKey = getSetting("gc_secret_key");
  if (!secretId || !secretKey) {
    throw new GcError("GoCardless-Zugangsdaten fehlen. Bitte in den Einstellungen Secret ID & Secret Key hinterlegen.");
  }

  const cached = getSetting("gc_access_token");
  const expiry = Number(getSetting("gc_access_expiry") || 0);
  if (cached && Date.now() < expiry - 60_000) return cached;

  const tok = await gcFetch("/token/new/", {
    method: "POST",
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  setSetting("gc_access_token", tok.access);
  setSetting("gc_access_expiry", String(Date.now() + tok.access_expires * 1000));
  return tok.access;
}

export async function findRevolutInstitution(country = "DE"): Promise<string> {
  const token = await getAccessToken();
  const list = (await gcFetch(`/institutions/?country=${country}`, {}, token)) as Array<{ id: string; name: string }>;
  const rev = list.find((i) => /revolut/i.test(i.name)) || list.find((i) => /revolut/i.test(i.id));
  if (!rev) throw new GcError(`Revolut wurde für Land ${country} nicht gefunden.`);
  return rev.id;
}

export async function createRequisition(redirectUrl: string, country = "DE") {
  const token = await getAccessToken();
  const institutionId = await findRevolutInstitution(country);

  const agreement = await gcFetch(
    "/agreements/enduser/",
    {
      method: "POST",
      body: JSON.stringify({
        institution_id: institutionId,
        max_historical_days: 730,
        access_valid_for_days: 180,
        access_scope: ["balances", "details", "transactions"],
      }),
    },
    token
  );

  const req = await gcFetch(
    "/requisitions/",
    {
      method: "POST",
      body: JSON.stringify({
        redirect: redirectUrl,
        institution_id: institutionId,
        reference: `achilles-${Date.now()}`,
        agreement: agreement.id,
        user_language: "DE",
      }),
    },
    token
  );

  setSetting("gc_requisition_id", req.id);
  setSetting("gc_requisition_status", "created");
  return { id: req.id as string, link: req.link as string };
}

export async function getRequisitionStatus(): Promise<{ status: string; accounts: string[] } | null> {
  const reqId = getSetting("gc_requisition_id");
  if (!reqId) return null;
  const token = await getAccessToken();
  const req = await gcFetch(`/requisitions/${reqId}/`, {}, token);
  return { status: req.status, accounts: req.accounts || [] };
}

export async function syncAccounts(): Promise<{ accounts: number; transactions: number }> {
  const token = await getAccessToken();
  const reqId = getSetting("gc_requisition_id");
  if (!reqId) throw new GcError("Keine Revolut-Verbindung vorhanden. Bitte zuerst per QR-Code verbinden.");

  const req = await gcFetch(`/requisitions/${reqId}/`, {}, token);
  if (req.status !== "LN") {
    throw new GcError(`Verbindung noch nicht autorisiert (Status: ${req.status}). Bitte QR-Code-Flow abschließen.`);
  }

  const d = db();
  let txCount = 0;

  for (const accountId of req.accounts as string[]) {
    const [details, balances] = await Promise.all([
      gcFetch(`/accounts/${accountId}/details/`, {}, token).catch(() => null),
      gcFetch(`/accounts/${accountId}/balances/`, {}, token).catch(() => null),
    ]);

    const acc = details?.account || {};
    const balance =
      balances?.balances?.find((b: { balanceType: string }) => ["interimAvailable", "expected", "closingBooked"].includes(b.balanceType)) ||
      balances?.balances?.[0];

    d.prepare(
      `INSERT INTO accounts (id, provider, name, iban, currency, balance, last_synced)
       VALUES (?, 'revolut', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, iban = excluded.iban,
         currency = excluded.currency, balance = excluded.balance, last_synced = excluded.last_synced`
    ).run(
      accountId,
      acc.name || acc.product || "Revolut",
      acc.iban || null,
      acc.currency || "EUR",
      balance ? Number(balance.balanceAmount.amount) : 0,
      new Date().toISOString()
    );

    const dateFrom = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const txData = await gcFetch(`/accounts/${accountId}/transactions/?date_from=${dateFrom}`, {}, token).catch(() => null);
    if (!txData) continue;

    const upsert = d.prepare(
      `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         booking_date = excluded.booking_date, amount = excluded.amount, pending = excluded.pending,
         merchant = COALESCE(transactions.merchant, excluded.merchant),
         category = CASE WHEN transactions.category_locked = 1 THEN transactions.category ELSE excluded.category END`
    );

    type GcTx = {
      transactionId?: string;
      internalTransactionId?: string;
      bookingDate?: string;
      valueDate?: string;
      transactionAmount: { amount: string; currency: string };
      creditorName?: string;
      debtorName?: string;
      remittanceInformationUnstructured?: string;
      remittanceInformationUnstructuredArray?: string[];
    };

    const ingest = (list: GcTx[], pending: number) => {
      for (const t of list || []) {
        const amount = Number(t.transactionAmount.amount);
        const merchant = t.creditorName || t.debtorName || null;
        const desc =
          t.remittanceInformationUnstructured ||
          (t.remittanceInformationUnstructuredArray || []).join(" ") ||
          null;
        const id = t.transactionId || t.internalTransactionId || `${accountId}-${t.bookingDate}-${amount}-${merchant ?? desc ?? ""}`;
        const date = t.bookingDate || t.valueDate || new Date().toISOString().slice(0, 10);
        upsert.run(id, accountId, date, amount, t.transactionAmount.currency, merchant, desc, categorize(merchant, desc, amount), pending);
        txCount++;
      }
    };

    ingest(txData.transactions?.booked, 0);
    ingest(txData.transactions?.pending, 1);
  }

  setSetting("gc_last_sync", new Date().toISOString());
  return { accounts: (req.accounts as string[]).length, transactions: txCount };
}
