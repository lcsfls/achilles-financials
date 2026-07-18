import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Cap per photo. The browser downscales before upload; this is the backstop. */
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Serve one photo. Behind the login guard like every other /api route. */
export async function GET(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const row = db().prepare("SELECT image, mime FROM property_photos WHERE id = ?").get(id) as
    | { image: Buffer; mime: string }
    | undefined;
  if (!row) return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });

  return new NextResponse(new Uint8Array(row.image), {
    headers: {
      "Content-Type": row.mime,
      // Immutable: a photo row is never rewritten, only added or deleted.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const propertyId = Number(form.get("propertyId"));
  const file = form.get("file");

  if (!propertyId || !(file instanceof File)) {
    return NextResponse.json({ error: "propertyId und Datei erforderlich" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Nur JPEG-, PNG- oder WebP-Bilder." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Das Bild ist zu groß (${Math.round(file.size / 1024 / 1024)} MB). Erlaubt sind ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }
  const exists = db().prepare("SELECT id FROM properties WHERE id = ?").get(propertyId);
  if (!exists) return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const info = db()
    .prepare("INSERT INTO property_photos (property_id, image, mime, created_at) VALUES (?, ?, ?, ?)")
    .run(propertyId, buf, file.type, new Date().toISOString());
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  db().prepare("DELETE FROM property_photos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
