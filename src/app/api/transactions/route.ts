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
