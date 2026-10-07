import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";


export async function POST({ request: req }: RequestEvent) {
  const b = await req.json();
  const amount = Number(b.amount_eur);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Der Betrag muss größer als 0 sein." }, { status: 400 });
  }
  const loan = db().prepare("SELECT id FROM loans WHERE id = ?").get(Number(b.loan_id));
  if (!loan) return json({ error: "Kredit nicht gefunden" }, { status: 404 });

  db()
    .prepare("INSERT INTO loan_payments (loan_id, paid_on, amount_eur, note) VALUES (?, ?, ?, ?)")
    .run(Number(b.loan_id), b.paid_on || new Date().toISOString().slice(0, 10), amount, b.note?.trim() || null);
  return json({ ok: true });
}

export async function DELETE({ request: req }: RequestEvent) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM loan_payments WHERE id = ?").run(id);
  return json({ ok: true });
}
