import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * German statutory pension notices.
 *
 * Read-only as far as net worth is concerned: an entitlement is a monthly
 * income you cannot sell, so this route deliberately feeds no asset total.
 */
export async function GET() {
  const notices = db().prepare("SELECT * FROM pension_statutory ORDER BY notice_date DESC").all();
  return NextResponse.json({ notices, latest: notices[0] ?? null });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.notice_date) return NextResponse.json({ error: "Datum erforderlich" }, { status: 400 });

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
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM pension_statutory WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
