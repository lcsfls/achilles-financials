import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_PARAMS, normalizeParams } from "@/lib/fire";

export const dynamic = "force-dynamic";

type Row = { id: number; name: string; params: string; created_at: string; sort_order: number };

/** Gespeicherte Szenarien; beim ersten Aufruf wird eines angelegt. */
export async function GET() {
  const d = db();
  let rows = d.prepare("SELECT * FROM fire_scenarios ORDER BY sort_order, id").all() as Row[];

  if (rows.length === 0) {
    // Frühere Versionen hatten genau einen Parametersatz in den Settings —
    // den als erstes Szenario übernehmen statt ihn zu verlieren.
    const legacy = d.prepare("SELECT value FROM settings WHERE key = 'fire_params'").get() as { value: string } | undefined;
    const params = legacy ? normalizeParams(JSON.parse(legacy.value)) : DEFAULT_PARAMS;
    d.prepare("INSERT INTO fire_scenarios (name, params, created_at, sort_order) VALUES (?, ?, ?, 0)")
      .run("Basis", JSON.stringify(params), new Date().toISOString());
    if (legacy) d.prepare("DELETE FROM settings WHERE key = 'fire_params'").run();
    rows = d.prepare("SELECT * FROM fire_scenarios ORDER BY sort_order, id").all() as Row[];
  }

  return NextResponse.json({
    scenarios: rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, params: normalizeParams(JSON.parse(r.params)) })),
  });
}

export async function POST(req: NextRequest) {
  const { name, params } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

  const d = db();
  const max = (d.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM fire_scenarios").get() as { m: number }).m;
  const r = d.prepare("INSERT INTO fire_scenarios (name, params, created_at, sort_order) VALUES (?, ?, ?, ?)")
    .run(name.trim(), JSON.stringify(normalizeParams(params)), new Date().toISOString(), max + 1);
  return NextResponse.json({ ok: true, id: r.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const { id, name, params } = await req.json();
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const d = db();
  if (name !== undefined) d.prepare("UPDATE fire_scenarios SET name = ? WHERE id = ?").run(String(name).trim(), id);
  if (params !== undefined) d.prepare("UPDATE fire_scenarios SET params = ? WHERE id = ?").run(JSON.stringify(normalizeParams(params)), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const d = db();
  const count = (d.prepare("SELECT COUNT(*) AS c FROM fire_scenarios").get() as { c: number }).c;
  if (count <= 1) return NextResponse.json({ error: "Das letzte Szenario kann nicht gelöscht werden." }, { status: 400 });
  d.prepare("DELETE FROM fire_scenarios WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
