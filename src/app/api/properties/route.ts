import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type Property = {
  id: number; label: string; address: string | null; value_eur: number;
  value_source: string | null; valued_on: string | null;
  purchase_price_eur: number | null; purchase_date: string | null;
  size_sqm: number | null; note: string | null; created_at: string;
};

export async function GET() {
  const d = db();
  const rows = d.prepare("SELECT * FROM properties ORDER BY created_at DESC").all() as Property[];
  // Only the photo ids — the images themselves are served one by one, so a
  // page with several properties doesn't ship megabytes of base64.
  const photos = d.prepare("SELECT id, property_id FROM property_photos ORDER BY id").all() as Array<{ id: number; property_id: number }>;

  const properties = rows.map((p) => ({
    ...p,
    photoIds: photos.filter((ph) => ph.property_id === p.id).map((ph) => ph.id),
    // Gain since purchase, when both numbers are known
    gain: p.purchase_price_eur ? p.value_eur - p.purchase_price_eur : null,
    gainPct: p.purchase_price_eur ? ((p.value_eur - p.purchase_price_eur) / p.purchase_price_eur) * 100 : null,
  }));

  return NextResponse.json({
    properties,
    total: rows.reduce((s, p) => s + p.value_eur, 0),
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const label = String(b.label ?? "").trim();
  const value = Number(b.value_eur);
  if (!label) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Der Wert muss eine Zahl sein." }, { status: 400 });
  }

  const info = db()
    .prepare(
      `INSERT INTO properties (label, address, value_eur, value_source, valued_on,
         purchase_price_eur, purchase_date, size_sqm, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      label,
      b.address?.trim() || null,
      value,
      b.value_source?.trim() || null,
      b.valued_on || new Date().toISOString().slice(0, 10),
      Number.isFinite(Number(b.purchase_price_eur)) && b.purchase_price_eur !== "" ? Number(b.purchase_price_eur) : null,
      b.purchase_date || null,
      Number.isFinite(Number(b.size_sqm)) && b.size_sqm !== "" ? Number(b.size_sqm) : null,
      b.note?.trim() || null,
      new Date().toISOString()
    );
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

/** Update the value (the field that actually changes over time). */
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (typeof b.id !== "number") return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  const value = Number(b.value_eur);
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Der Wert muss eine Zahl sein." }, { status: 400 });
  }
  db()
    .prepare("UPDATE properties SET value_eur = ?, value_source = ?, valued_on = ? WHERE id = ?")
    .run(value, b.value_source?.trim() || null, b.valued_on || new Date().toISOString().slice(0, 10), b.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  // Photos first — they reference the property.
  db().transaction(() => {
    db().prepare("DELETE FROM property_photos WHERE property_id = ?").run(id);
    db().prepare("DELETE FROM properties WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
