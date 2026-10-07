import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { db } from "$lib/server/db";


/**
 * German statutory pension notices.
 *
 * Read-only as far as net worth is concerned: an entitlement is a monthly
 * income you cannot sell, so this route deliberately feeds no asset total.
 */
export async function GET() {
  const notices = db().prepare("SELECT * FROM pension_statutory ORDER BY notice_date DESC").all();
  return json({ notices, latest: notices[0] ?? null });
}

export async function POST({ request: req }: RequestEvent) {
  const b = await req.json();
  if (!b.notice_date) return json({ error: "Datum erforderlich" }, { status: 400 });

  const opt = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const info = db()
    .prepare(`INSERT INTO pension_statutory
      (notice_date, kind, disability_eur, earned_eur, projected_eur, points, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      b.notice_date,
      b.kind === "rentenbescheid" ? "rentenbescheid" : "renteninformation",
      opt(b.disability_eur), opt(b.earned_eur), opt(b.projected_eur), opt(b.points),
      b.note?.trim() || null
    );
  return json({ ok: true, id: info.lastInsertRowid });
}

export async function DELETE({ request: req }: RequestEvent) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM pension_statutory WHERE id = ?").run(id);
  return json({ ok: true });
}
