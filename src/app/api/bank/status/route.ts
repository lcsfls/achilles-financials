import { NextResponse } from "next/server";
import { db, getSetting } from "@/lib/db";
import { getSessionStatus } from "@/lib/enablebanking";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string; provider: string; name: string | null; iban: string | null;
  currency: string | null; balance: number; last_synced: string | null; txCount: number;
};

/**
 * Die verknüpften Konten kommen aus der Datenbank, nicht erneut von der Bank:
 * Nach dem Sync steht dort der Stand, den die App auch überall sonst zeigt —
 * und es kostet keinen API-Aufruf, nur um eine Liste anzuzeigen.
 */
function accountList(): AccountRow[] {
  return db()
    .prepare(
      `SELECT a.id, a.provider, a.name, a.iban, a.currency, a.balance, a.last_synced,
              (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS txCount
         FROM accounts a ORDER BY a.name`
    )
    .all() as AccountRow[];
}

export async function GET() {
  const hasCreds = Boolean(getSetting("eb_app_id") && getSetting("eb_private_key"));
  const list = accountList();
  const base = {
    hasCreds,
    aspsp: getSetting("eb_aspsp_name"),
    country: getSetting("eb_country") || "DE",
    lastSync: getSetting("eb_last_sync"),
    linkedAt: getSetting("eb_linked_at"),
  };

  if (!hasCreds) return NextResponse.json({ ...base, status: null, accounts: list.length, list });

  try {
    const session = await getSessionStatus();
    return NextResponse.json({ ...base, status: session?.status ?? null, accounts: session?.accounts ?? list.length, list });
  } catch (e) {
    return NextResponse.json({ ...base, status: null, accounts: list.length, list, error: e instanceof Error ? e.message : "Fehler" });
  }
}
