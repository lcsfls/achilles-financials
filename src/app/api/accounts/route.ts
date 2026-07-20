import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSupported } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * Accounts kept by hand.
 *
 * The point is that the app is usable without any bank connection at all:
 * a cash box, a savings account at a bank that has no API, a shared account
 * someone else reports to you. Their balance is edited directly and no sync
 * ever touches them.
 */
export async function GET() {
  const accounts = db()
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS tx_count
         FROM accounts a ORDER BY a.manual, a.name`
    )
    .all();
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

  const currency = String(b.currency || "EUR").toUpperCase();
  if (!isSupported(currency)) return NextResponse.json({ error: "Unbekannte Währung" }, { status: 400 });

  const balance = Number(b.balance) || 0;
  const id = `manual-acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db()
    .prepare("INSERT INTO accounts (id, provider, name, iban, currency, balance, manual, last_synced) VALUES (?, 'manual', ?, NULL, ?, ?, 1, ?)")
    .run(id, name, currency, balance, new Date().toISOString());
  return NextResponse.json({ ok: true, id });
}

/** Set a manual account's balance or rename it. */
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const account = db().prepare("SELECT id, manual FROM accounts WHERE id = ?").get(b.id) as
    | { id: string; manual: number }
    | undefined;
  if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
  if (!account.manual) {
    return NextResponse.json({ error: "Bankkonten werden vom Abruf gepflegt und lassen sich nicht von Hand ändern." }, { status: 400 });
  }

  if (b.name !== undefined && String(b.name).trim()) {
    db().prepare("UPDATE accounts SET name = ? WHERE id = ?").run(String(b.name).trim(), b.id);
  }
  if (b.balance !== undefined && Number.isFinite(Number(b.balance))) {
    db().prepare("UPDATE accounts SET balance = ?, last_synced = ? WHERE id = ?")
      .run(Number(b.balance), new Date().toISOString(), b.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const account = db().prepare("SELECT id, manual FROM accounts WHERE id = ?").get(id) as
    | { id: string; manual: number }
    | undefined;
  if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
  if (!account.manual) {
    return NextResponse.json({ error: "Bankkonten werden über die Verbindung entfernt, nicht hier." }, { status: 400 });
  }

  // Transactions first — they would otherwise point at a missing account and
  // keep showing up in the list.
  db().transaction(() => {
    db().prepare("DELETE FROM transactions WHERE account_id = ?").run(id);
    db().prepare("DELETE FROM accounts WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
