import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contractStats, waterfall, type Statement } from "@/lib/pension";

export const dynamic = "force-dynamic";

type Contract = {
  id: number; label: string; kind: "pension" | "life";
  provider: string | null; monthly_eur: number | null; note: string | null; created_at: string;
};

export async function GET() {
  const d = db();
  const contracts = d.prepare("SELECT * FROM pension_contracts ORDER BY created_at").all() as Contract[];
  const all = d.prepare("SELECT * FROM pension_statements ORDER BY statement_date").all() as Array<Statement & { contract_id: number | null }>;

  const withStats = contracts.map((c) => {
    const statements = all
      .filter((s) => s.contract_id === c.id)
      // The waterfall travels with the row so the table can expand without a
      // second request per statement.
      .map((s) => ({ ...s, waterfall: waterfall(s) }));
    return { ...c, statements, stats: contractStats(statements) };
  });

  return NextResponse.json({
    contracts: withStats,
    // Net worth counts the latest balance of every contract.
    totalBalance: withStats.reduce((s, c) => s + c.stats.latestBalance, 0),
    totalContrib: withStats.reduce((s, c) => s + c.stats.totalContrib, 0),
    totalReturn: withStats.reduce((s, c) => s + c.stats.netReturn, 0),
  });
}

/** Create a contract, or add a statement to one. */
export async function POST(req: NextRequest) {
  const b = await req.json();

  if (b.contract) {
    const label = String(b.contract.label ?? "").trim();
    if (!label) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });
    const info = db()
      .prepare("INSERT INTO pension_contracts (label, kind, provider, monthly_eur, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        label,
        b.contract.kind === "life" ? "life" : "pension",
        b.contract.provider?.trim() || null,
        Number(b.contract.monthly_eur) || null,
        b.contract.note?.trim() || null,
        new Date().toISOString()
      );
    return NextResponse.json({ ok: true, id: info.lastInsertRowid });
  }

  const { contract_id, statement_date, balance_eur, contribution_eur, note } = b;
  if (!contract_id) return NextResponse.json({ error: "Vertrag erforderlich" }, { status: 400 });
  if (!statement_date || !(balance_eur >= 0)) {
    return NextResponse.json({ error: "Datum und Stand sind erforderlich" }, { status: 400 });
  }
  const exists = db().prepare("SELECT id FROM pension_contracts WHERE id = ?").get(Number(contract_id));
  if (!exists) return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });

  // Optional line items — an empty field must stay NULL rather than become 0,
  // or a statement nobody detailed would claim its costs were zero.
  const opt = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

  db()
    .prepare(`INSERT INTO pension_statements
      (contract_id, statement_date, balance_eur, contribution_eur, note,
       prev_balance_eur, fund_performance_eur, earned_returns_eur,
       acquisition_costs_eur, admin_costs_eur, total_paid_eur)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      Number(contract_id), statement_date, Number(balance_eur),
      opt(contribution_eur), note?.trim() || null,
      opt(b.prev_balance_eur), opt(b.fund_performance_eur), opt(b.earned_returns_eur),
      opt(b.acquisition_costs_eur), opt(b.admin_costs_eur), opt(b.total_paid_eur)
    );
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (typeof b.id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db()
    .prepare("UPDATE pension_contracts SET label = COALESCE(?, label), kind = COALESCE(?, kind), provider = ?, monthly_eur = ?, note = ? WHERE id = ?")
    .run(
      b.label?.trim() || null,
      b.kind === "life" || b.kind === "pension" ? b.kind : null,
      b.provider?.trim() || null,
      Number(b.monthly_eur) || null,
      b.note?.trim() || null,
      b.id
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const statementId = Number(params.get("statement"));
  const contractId = Number(params.get("contract"));

  if (statementId) {
    db().prepare("DELETE FROM pension_statements WHERE id = ?").run(statementId);
    return NextResponse.json({ ok: true });
  }
  if (contractId) {
    // Statements first — they reference the contract.
    db().transaction(() => {
      db().prepare("DELETE FROM pension_statements WHERE contract_id = ?").run(contractId);
      db().prepare("DELETE FROM pension_contracts WHERE id = ?").run(contractId);
    })();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
}
