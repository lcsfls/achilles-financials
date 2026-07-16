import { NextRequest, NextResponse } from "next/server";
import { BackupError, backupFilename, createBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Verschlüsseltes Backup erzeugen und als Download ausliefern. */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "Passwort erforderlich" }, { status: 400 });

    const data = await createBackup(String(password));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${backupFilename()}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (e) {
    const msg = e instanceof BackupError ? e.message : "Backup fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: e instanceof BackupError ? 400 : 500 });
  }
}
