import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { BackupError, backupFilename, createBackup } from "$lib/server/backup";


/** Verschlüsseltes Backup erzeugen und als Download ausliefern. */
export async function POST({ request: req }: RequestEvent) {
  try {
    const { password } = await req.json();
    if (!password) return json({ error: "Passwort erforderlich" }, { status: 400 });

    const data = await createBackup(String(password));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${backupFilename()}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (e) {
    const msg = e instanceof BackupError ? e.message : "Backup fehlgeschlagen";
    return json({ error: msg }, { status: e instanceof BackupError ? 400 : 500 });
  }
}
