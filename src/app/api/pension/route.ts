import { NextRequest, NextResponse } from "next/server";
import { db, getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const statements = db()
    .prepare("SELECT * FROM pension_statements ORDER BY statement_date")
    .all() as Array<{ id: number; statement_date: string; balance_eur: number; contribution_eur: number | null; note: string | null }>;

  const latest = statements[statements.length - 1] ?? null;
  const totalContrib = statements.reduce((s, r) => s + (r.contribution_eur ?? 0), 0);

  return NextResponse.json({
    statements,
    latestBalance: latest?.balance_eur ?? 0,
    latestDate: latest?.statement_date ?? null,
    totalContrib,
    provider: getSetting("pension_provider") || "",
    monthlyContribution: Number(getSetting("pension_monthly") || 0),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Meta-Einstellungen (Anbieter, monatlicher Beitrag)
  if (body.provider !== undefined || body.monthlyContribution !== undefined) {
    if (body.provider !== undefined) setSetting("pension_provider", String(body.provider));
    if (body.monthlyContribution !== undefined) setSetting("pension_monthly", String(body.monthlyContribution || 0));
    return NextResponse.json({ ok: true });
  }

  // Neuer Kontoauszug
  const { statement_date, balance_eur, contribution_eur, note } = body;
  if (!statement_date || !(balance_eur >= 0)) {
    return NextResponse.json({ error: "Datum und Stand sind erforderlich" }, { status: 400 });
  }
  const result = db()
    .prepare("INSERT INTO pension_statements (statement_date, balance_eur, contribution_eur, note) VALUES (?, ?, ?, ?)")
    .run(statement_date, balance_eur, contribution_eur ?? null, note || null);
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM pension_statements WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
