import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { valuate, type BusinessInput } from "@/lib/business";

export const dynamic = "force-dynamic";

type Row = { id: number; label: string; kind: "own" | "target"; inputs: string; note: string | null; created_at: string; updated_at: string | null };

export async function GET() {
  const rows = db().prepare("SELECT * FROM businesses ORDER BY created_at DESC").all() as Row[];
  const businesses = rows.map((r) => {
    const inputs = JSON.parse(r.inputs) as BusinessInput;
    // Valued on read, not on write: a change to the model then applies to every
    // saved entry instead of leaving stale numbers behind.
    return { id: r.id, label: r.label, kind: r.kind, note: r.note, created_at: r.created_at, inputs, result: valuate(inputs) };
  });
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const label = String(b.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });
  if (!b.inputs || typeof b.inputs !== "object") {
    return NextResponse.json({ error: "Eingaben fehlen" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const info = db()
    .prepare("INSERT INTO businesses (label, kind, inputs, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(label, b.kind === "target" ? "target" : "own", JSON.stringify(b.inputs), b.note?.trim() || null, now, now);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (typeof b.id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  if (!b.inputs || typeof b.inputs !== "object") {
    return NextResponse.json({ error: "Eingaben fehlen" }, { status: 400 });
  }
  db()
    .prepare("UPDATE businesses SET label = COALESCE(?, label), kind = COALESCE(?, kind), inputs = ?, note = ?, updated_at = ? WHERE id = ?")
    .run(b.label?.trim() || null, b.kind === "target" || b.kind === "own" ? b.kind : null, JSON.stringify(b.inputs), b.note?.trim() || null, new Date().toISOString(), b.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM businesses WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
