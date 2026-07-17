import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loanState, type Loan, type Payment } from "@/lib/loans";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  const d = db();
  const loans = d.prepare("SELECT * FROM loans ORDER BY closed, start_date DESC").all() as Loan[];
  const payments = d.prepare("SELECT * FROM loan_payments ORDER BY paid_on").all() as Array<Payment & { loan_id: number }>;

  const asOf = today();
  const withState = loans.map((l) => {
    const own = payments.filter((p) => p.loan_id === l.id);
    return { ...l, payments: own, state: loanState(l, own, asOf) };
  });

  // Verliehenes ist eine Forderung, Aufgenommenes eine Schuld — getrennt
  // ausweisen statt saldieren: Die beiden Zahlen bedeuten Verschiedenes.
  const open = withState.filter((l) => !l.closed);
  return NextResponse.json({
    loans: withState,
    totals: {
      lent: open.filter((l) => l.direction === "lent").reduce((s, l) => s + l.state.outstanding, 0),
      borrowed: open.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.state.outstanding, 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const principal = Number(b.principal_eur);
  if (!b.counterparty?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
  if (!Number.isFinite(principal) || principal <= 0) {
    return NextResponse.json({ error: "Die Summe muss größer als 0 sein." }, { status: 400 });
  }
  if (b.direction !== "lent" && b.direction !== "borrowed") {
    return NextResponse.json({ error: "Richtung fehlt" }, { status: 400 });
  }

  const info = db()
    .prepare(
      `INSERT INTO loans (direction, counterparty, kind, principal_eur, interest_pct, start_date, due_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.direction,
      String(b.counterparty).trim(),
      b.kind === "bank" ? "bank" : "private",
      principal,
      Math.max(0, Number(b.interest_pct) || 0),
      b.start_date || today(),
      b.due_date || null,
      b.note?.trim() || null
    );
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

/** Abschließen / wieder öffnen. */
export async function PATCH(req: NextRequest) {
  const { id, closed } = await req.json();
  if (typeof id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("UPDATE loans SET closed = ? WHERE id = ?").run(closed ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  // Zahlungen zuerst — sonst bleiben verwaiste Zeilen zurück
  db().transaction(() => {
    db().prepare("DELETE FROM loan_payments WHERE loan_id = ?").run(id);
    db().prepare("DELETE FROM loans WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
