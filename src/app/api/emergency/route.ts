import { NextRequest, NextResponse } from "next/server";
import { db, deleteSetting, getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Notgroschen: ein bestehendes Konto als zweckgebunden markieren + Zielbetrag. */
export async function GET() {
  const accounts = db()
    .prepare("SELECT id, name, balance, iban FROM accounts ORDER BY name")
    .all() as Array<{ id: string; name: string; balance: number; iban: string | null }>;

  const accountId = getSetting("emergency_account_id");
  const target = Number(getSetting("emergency_target_eur") || 0);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  // Ohne verknüpftes Konto zählt der manuell gepflegte Stand — nicht jeder
  // Notgroschen liegt auf einem Konto, das die App überhaupt sieht
  // (Tagesgeld bei einer anderen Bank, Bausparer, Bargeld).
  const manualBalance = Number(getSetting("emergency_manual_balance") || 0);
  const configured = Boolean(account) || target > 0 || manualBalance > 0;

  return NextResponse.json({
    accounts,
    accountId: account ? accountId : null, // verwaistes Konto nicht melden
    manual: !account,
    manualBalance,
    target,
    balance: account ? account.balance : manualBalance,
    configured,
    monthsOfExpenses: Number(getSetting("emergency_months") || 0),
  });
}

export async function POST(req: NextRequest) {
  const { accountId, target, monthsOfExpenses, manualBalance } = await req.json();

  if (accountId === null || accountId === "") {
    deleteSetting("emergency_account_id");
  } else if (accountId !== undefined) {
    const exists = db().prepare("SELECT 1 FROM accounts WHERE id = ?").get(String(accountId));
    if (!exists) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
    setSetting("emergency_account_id", String(accountId));
  }

  if (target !== undefined) {
    if (!(Number(target) >= 0)) return NextResponse.json({ error: "Ziel muss eine positive Zahl sein" }, { status: 400 });
    setSetting("emergency_target_eur", String(Number(target)));
  }
  if (monthsOfExpenses !== undefined) setSetting("emergency_months", String(Number(monthsOfExpenses) || 0));
  if (manualBalance !== undefined) {
    if (!(Number(manualBalance) >= 0)) return NextResponse.json({ error: "Stand muss eine positive Zahl sein" }, { status: 400 });
    setSetting("emergency_manual_balance", String(Number(manualBalance)));
  }

  return NextResponse.json({ ok: true });
}
