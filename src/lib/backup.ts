import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { db } from "./db";

/**
 * Verschlüsseltes Backup (.achillesbak).
 *
 * Die Datei enthält den Enable-Banking-Private-Key, den Passwort-Hash und
 * sämtliche Kontobewegungen — sie darf nirgends im Klartext liegen. Deshalb
 * AES-256-GCM mit einem per scrypt aus dem Passwort abgeleiteten Schlüssel;
 * GCM erkennt zugleich Manipulation und falsche Passwörter.
 *
 * Aufbau:
 *   magic "ACHILLESBAK1"  12 B
 *   salt                  16 B
 *   iv                    12 B
 *   authTag               16 B
 *   ciphertext            Rest  (gzip der SQLite-Datei)
 */

const MAGIC = Buffer.from("ACHILLESBAK1", "utf8");
const SCRYPT_N = 16384;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32, { N: SCRYPT_N, r: 8, p: 1 });
}

export class BackupError extends Error {
  // Ohne das meldet sich die Klasse im Log als "Error". Bei einem Pfad, der im
  // Ernstfall die einzige Datenrettung ist, will man sehen, welcher Fehler es
  // war — "Nutzerfehler" (falsches Passwort) vs. "kaputt" hängt daran.
  name = "BackupError";
}

export async function createBackup(password: string): Promise<Buffer> {
  if (password.length < 8) throw new BackupError("Das Backup-Passwort muss mindestens 8 Zeichen haben.");

  // Über .backup() statt roher Dateikopie: liefert einen konsistenten Stand,
  // auch wenn gerade geschrieben wird (WAL).
  const tmp = path.join(os.tmpdir(), `achilles-backup-${crypto.randomUUID()}.db`);
  try {
    await db().backup(tmp);
    const raw = fs.readFileSync(tmp);
    const gz = zlib.gzipSync(raw, { level: 9 });

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(password, salt), iv);
    const ciphertext = Buffer.concat([cipher.update(gz), cipher.final()]);

    return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export function backupFilename(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `achilles-${stamp}.achillesbak`;
}

export async function restoreBackup(file: Buffer, password: string): Promise<{ tables: number }> {
  if (file.length < 56 || !file.subarray(0, 12).equals(MAGIC)) {
    throw new BackupError("Das ist keine Achilles-Backup-Datei (.achillesbak).");
  }

  const salt = file.subarray(12, 28);
  const iv = file.subarray(28, 40);
  const authTag = file.subarray(40, 56);
  const ciphertext = file.subarray(56);

  let plain: Buffer;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(password, salt), iv);
    decipher.setAuthTag(authTag);
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM schlägt bei falschem Passwort genauso fehl wie bei defekter Datei —
    // unterscheiden lässt sich das nicht, also beides nennen.
    throw new BackupError("Entschlüsselung fehlgeschlagen — falsches Passwort oder beschädigte Datei.");
  }

  let restored: Buffer;
  try {
    restored = zlib.gunzipSync(plain);
  } catch {
    throw new BackupError("Backup-Inhalt ist beschädigt.");
  }

  // Nicht die Datei tauschen: Next.js bündelt Routen getrennt, jede hält ihre
  // eigene SQLite-Verbindung. Ein Dateitausch macht alle anderen Verbindungen
  // ungültig (SQLITE_IOERR_SHORT_READ). Stattdessen die Inhalte innerhalb der
  // laufenden Verbindung ersetzen — atomar in einer Transaktion.
  const tmp = path.join(os.tmpdir(), `achilles-restore-${crypto.randomUUID()}.db`);
  fs.writeFileSync(tmp, restored);

  const live = db();
  let tableCount = 0;
  try {
    live.prepare("ATTACH DATABASE ? AS bak").run(tmp);
  } catch {
    fs.rmSync(tmp, { force: true });
    throw new BackupError("Backup enthält keine lesbare Datenbank.");
  }

  try {
    const bakTables = (
      live.prepare("SELECT name FROM bak.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>
    ).map((r) => r.name);

    for (const required of ["settings", "accounts", "transactions"]) {
      if (!bakTables.includes(required)) throw new BackupError(`Backup unvollständig — Tabelle "${required}" fehlt.`);
    }

    const mainTables = (
      live.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>
    ).map((r) => r.name);

    const cols = (schema: string, table: string) =>
      (live.prepare(`PRAGMA ${schema}.table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);

    /*
     * Fremdschlüssel VOR der Transaktion abschalten, nicht darin.
     *
     * SQLite behandelt `PRAGMA foreign_keys` innerhalb einer offenen
     * Transaktion als No-op — es ist dort wirkungslos, ohne einen Fehler zu
     * melden. Die Prüfung blieb also aktiv, und das erste DELETE auf einer
     * referenzierten Tabelle brach die Wiederherstellung mit
     * "FOREIGN KEY constraint failed" ab. Die Tabellen werden bewusst in
     * beliebiger Reihenfolge ersetzt, deshalb muss die Prüfung ruhen.
     */
    live.pragma("foreign_keys = OFF");
    try {
      const copy = live.transaction(() => {
        for (const table of bakTables) {
          // Tabellen, die es hier nicht (mehr) gibt, überspringen statt scheitern
          if (!mainTables.includes(table)) continue;
          // Nur gemeinsame Spalten: ein älteres Backup kennt neuere nicht
          const shared = cols("bak", table).filter((c) => cols("main", table).includes(c));
          if (shared.length === 0) continue;
          const list = shared.map((c) => `"${c}"`).join(", ");
          live.prepare(`DELETE FROM main."${table}"`).run();
          live.prepare(`INSERT INTO main."${table}" (${list}) SELECT ${list} FROM bak."${table}"`).run();
          tableCount++;
        }
      });
      copy();
    } finally {
      // Auch nach einem Abbruch wieder einschalten, sonst liefe die App
      // danach ohne Fremdschlüsselprüfung weiter.
      live.pragma("foreign_keys = ON");
    }
  } finally {
    try { live.prepare("DETACH DATABASE bak").run(); } catch { /* egal */ }
    fs.rmSync(tmp, { force: true });
  }

  return { tables: tableCount };
}
