import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const month = searchParams.get("month"); // YYYY-MM
  const account = searchParams.get("account");
  const limit = Math.min(Number(searchParams.get("limit") || 200), 1000);

  let sql = "SELECT * FROM transactions WHERE 1=1";
  const params: (string | number)[] = [];

  if (q) {
    sql += " AND (merchant LIKE ? OR description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (month) {
    sql += " AND strftime('%Y-%m', booking_date) = ?";
    params.push(month);
  }
  if (account) {
    sql += " AND account_id = ?";
    params.push(account);
  }
  sql += " ORDER BY booking_date DESC, id DESC LIMIT ?";
  params.push(limit);

  const rows = db().prepare(sql).all(...params);

  const months = db()
    .prepare("SELECT DISTINCT strftime('%Y-%m', booking_date) AS m FROM transactions ORDER BY m DESC LIMIT 24")
    .all() as Array<{ m: string }>;

  // Nur Konten anbieten, zu denen es auch Buchungen gibt — ein Filter, der
  // garantiert nichts findet, ist keine Hilfe.
  const accounts = db()
    .prepare(
      `SELECT a.id, COALESCE(a.name, a.iban, a.id) AS name, COUNT(t.id) AS n
         FROM accounts a JOIN transactions t ON t.account_id = a.id
        GROUP BY a.id ORDER BY n DESC`
    )
    .all() as Array<{ id: string; name: string; n: number }>;

  return NextResponse.json({ transactions: rows, months: months.map((r) => r.m), accounts });
}

export async function PATCH(req: NextRequest) {
  const { id, category } = await req.json();
  if (!id || !category) return NextResponse.json({ error: "id und category erforderlich" }, { status: 400 });
  db().prepare("UPDATE transactions SET category = ?, category_locked = 1 WHERE id = ?").run(category, id);
  return NextResponse.json({ ok: true });
}

/**
 * Create a transaction by hand.
 *
 * Only for manual accounts. A bank-synced account is a mirror of what the bank
 * reports; writing our own rows into it would be silently overwritten on the
 * next sync and would make the balance disagree with the bank.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const amount = Number(b.amount);
  if (!b.account_id) return NextResponse.json({ error: "Konto erforderlich" }, { status: 400 });
  if (!b.booking_date) return NextResponse.json({ error: "Datum erforderlich" }, { status: 400 });
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "Betrag darf nicht 0 sein." }, { status: 400 });
  }

  const d = db();
  const account = d.prepare("SELECT id, manual, currency FROM accounts WHERE id = ?").get(b.account_id) as
    | { id: string; manual: number; currency: string }
    | undefined;
  if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
  if (!account.manual) {
    return NextResponse.json(
      { error: "Nur bei manuell geführten Konten. Bei Bankkonten würde der nächste Abruf den Eintrag überschreiben." },
      { status: 400 }
    );
  }

  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Row and running balance move together, or the account would drift away
  // from its own transactions on a partial failure.
  d.transaction(() => {
    d.prepare(
      `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, category_locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, account.id, b.booking_date, amount, account.currency || "EUR",
      b.merchant?.trim() || null, b.description?.trim() || null,
      b.category || null, b.category ? 1 : 0
    );
    d.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, account.id);
  })();

  return NextResponse.json({ ok: true, id });
}

/** Delete a manual transaction and take its amount back out of the balance. */
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const d = db();
  const tx = d
    .prepare(
      `SELECT t.id, t.amount, t.account_id, a.manual
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.id = ?`
    )
    .get(id) as { id: string; amount: number; account_id: string; manual: number } | undefined;
  if (!tx) return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  if (!tx.manual) {
    return NextResponse.json({ error: "Buchungen von Bankkonten lassen sich nicht löschen." }, { status: 400 });
  }

  d.transaction(() => {
    d.prepare("DELETE FROM transactions WHERE id = ?").run(id);
    d.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(tx.amount, tx.account_id);
  })();
  return NextResponse.json({ ok: true });
}
