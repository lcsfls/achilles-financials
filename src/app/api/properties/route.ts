import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type Property = {
  id: number; label: string; address: string | null; value_eur: number;
  value_source: string | null; valued_on: string | null;
  purchase_price_eur: number | null; purchase_date: string | null;
  size_sqm: number | null; share_pct: number; note: string | null; created_at: string;
};

export async function GET() {
  const d = db();
  const rows = d.prepare("SELECT * FROM properties ORDER BY created_at DESC").all() as Property[];
  // Only the photo ids — the images themselves are served one by one, so a
  // page with several properties doesn't ship megabytes of base64.
  const photos = d.prepare("SELECT id, property_id FROM property_photos ORDER BY id").all() as Array<{ id: number; property_id: number }>;

  const properties = rows.map((p) => {
    const share = (p.share_pct ?? 100) / 100;
    // Everything monetary is reported as *your* portion: with a 50 % share the
    // net worth, the gain and the €/m² must all reflect half, not the whole.
    const myValue = p.value_eur * share;
    const myPurchase = p.purchase_price_eur === null ? null : p.purchase_price_eur * share;
    return {
      ...p,
      photoIds: photos.filter((ph) => ph.property_id === p.id).map((ph) => ph.id),
      myValue,
      myPurchase,
      gain: myPurchase ? myValue - myPurchase : null,
      gainPct: myPurchase ? ((myValue - myPurchase) / myPurchase) * 100 : null,
    };
  });

  return NextResponse.json({
    properties,
    // The total is the sum of the shares owned, not of the full values.
    total: properties.reduce((s, p) => s + p.myValue, 0),
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
         purchase_price_eur, purchase_date, size_sqm, share_pct, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      // Clamp: a share outside 0–100 % would silently distort net worth.
      Math.min(100, Math.max(0, Number(b.share_pct) || 100)),
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
  // Label and address are optional here: an empty string means "leave it",
  // not "clear it" — a rename dialog that blanks the name on an untouched
  // field would be worse than not offering the rename at all.
  const label = typeof b.label === "string" && b.label.trim() ? b.label.trim() : null;
  const address = b.address === undefined ? null : String(b.address).trim() || null;

  db()
    .prepare(
      `UPDATE properties
          SET value_eur = ?, value_source = ?, valued_on = ?,
              share_pct = COALESCE(?, share_pct),
              label = COALESCE(?, label),
              address = CASE WHEN ? THEN ? ELSE address END
        WHERE id = ?`
    )
    .run(
      value,
      b.value_source?.trim() || null,
      b.valued_on || new Date().toISOString().slice(0, 10),
      b.share_pct === undefined ? null : Math.min(100, Math.max(0, Number(b.share_pct) || 0)),
      label,
      b.address === undefined ? 0 : 1,
      address,
      b.id
    );
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
