import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loanState, type Loan, type Payment } from "@/lib/loans";
import { schedule } from "@/lib/amortization";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  const d = db();
  const loans = d.prepare("SELECT * FROM loans ORDER BY closed, start_date DESC").all() as Loan[];
  const payments = d.prepare("SELECT * FROM loan_payments ORDER BY paid_on").all() as Array<Payment & { loan_id: number }>;

  const asOf = today();
  const withState = loans.map((l) => {
    const own = payments.filter((p) => p.loan_id === l.id);
    const state = loanState(l, own, asOf);
    // The plan starts from what is still owed today, not from the original
    // principal — otherwise it would ignore every payment already made.
    const plan = l.monthly_payment_eur
      ? schedule({
          balance: state.outstanding,
          interestPct: l.interest_pct,
          monthlyPayment: l.monthly_payment_eur,
          startDate: asOf,
        })
      : null;
    return { ...l, payments: own, state, plan };
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
      `INSERT INTO loans (direction, counterparty, kind, principal_eur, interest_pct, start_date, due_date, note, monthly_payment_eur)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.direction,
      String(b.counterparty).trim(),
      b.kind === "bank" ? "bank" : "private",
      principal,
      Math.max(0, Number(b.interest_pct) || 0),
      b.start_date || today(),
      b.due_date || null,
      b.note?.trim() || null,
      Number(b.monthly_payment_eur) || null
    );
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

/**
 * Abschließen / wieder öffnen, oder die Konditionen ändern.
 *
 * Jedes Feld ist einzeln optional: Der Karten-Knopf zum Abschließen schickt nur
 * `closed`, der Bearbeiten-Dialog die Konditionen. Würde ein fehlendes Feld als
 * "leeren" gelten, löschte der Abschließen-Knopf nebenbei den halben Kredit.
 */
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const { id } = b;
  if (typeof id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const exists = db().prepare("SELECT id FROM loans WHERE id = ?").get(id);
  if (!exists) return NextResponse.json({ error: "Kredit nicht gefunden" }, { status: 404 });

  if (b.counterparty !== undefined && !String(b.counterparty).trim()) {
    return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
  }
  if (b.principal_eur !== undefined && !(Number(b.principal_eur) > 0)) {
    return NextResponse.json({ error: "Die Summe muss größer als 0 sein." }, { status: 400 });
  }

  const d = db();
  const set = (col: string, value: unknown) =>
    d.prepare(`UPDATE loans SET ${col} = ? WHERE id = ?`).run(value, id);

  if (b.counterparty !== undefined) set("counterparty", String(b.counterparty).trim());
  if (b.note !== undefined) set("note", String(b.note).trim() || null);
  if (b.kind !== undefined) set("kind", b.kind === "bank" ? "bank" : "private");
  if (b.direction !== undefined && (b.direction === "lent" || b.direction === "borrowed")) {
    set("direction", b.direction);
  }
  if (b.principal_eur !== undefined) set("principal_eur", Number(b.principal_eur));
  if (b.interest_pct !== undefined) set("interest_pct", Math.max(0, Number(b.interest_pct) || 0));
  if (b.start_date !== undefined && b.start_date) set("start_date", b.start_date);
  if (b.due_date !== undefined) set("due_date", b.due_date || null);
  // 0 or empty clears the rate, which removes the schedule
  if (b.monthly_payment_eur !== undefined) set("monthly_payment_eur", Number(b.monthly_payment_eur) || null);
  if (b.closed !== undefined) set("closed", b.closed ? 1 : 0);

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
