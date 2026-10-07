import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { BackupError, restoreBackup } from "$lib/server/backup";


/**
 * Backup einspielen. Ersetzt die gesamte Datenbank — inklusive Login und
 * Bank-Zugangsdaten aus dem Backup.
 */
export async function POST({ request: req }: RequestEvent) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const password = form.get("password");

    if (!(file instanceof File)) return json({ error: "Datei fehlt" }, { status: 400 });
    if (typeof password !== "string" || !password) {
      return json({ error: "Passwort erforderlich" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await restoreBackup(buf, password);
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof BackupError ? e.message : "Wiederherstellung fehlgeschlagen";
    return json({ error: msg }, { status: e instanceof BackupError ? 400 : 500 });
  }
}
