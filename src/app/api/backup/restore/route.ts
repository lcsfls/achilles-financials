import { NextRequest, NextResponse } from "next/server";
import { BackupError, restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Backup einspielen. Ersetzt die gesamte Datenbank — inklusive Login und
 * Bank-Zugangsdaten aus dem Backup.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const password = form.get("password");

    if (!(file instanceof File)) return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Passwort erforderlich" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await restoreBackup(buf, password);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof BackupError ? e.message : "Wiederherstellung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: e instanceof BackupError ? 400 : 500 });
  }
}
