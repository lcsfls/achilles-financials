import crypto from "crypto";
import { getSetting, setSetting, deleteSetting } from "./db";

/**
 * Login mit Benutzername + Passwort.
 *
 * Bewusst ohne externe Abhängigkeit: scrypt steckt in node:crypto und ist für
 * Passwörter ausgelegt (speicherhart). Ein einzelner Nutzer, eine Sitzung —
 * mehr braucht ein selbstgehostetes Dashboard nicht.
 */

const SCRYPT_N = 16384;
const SESSION_DAYS = 30;
export const SESSION_COOKIE = "achilles_session";

export function authEnabled(): boolean {
  return Boolean(getSetting("auth_user") && getSetting("auth_hash"));
}

export function getUsername(): string | null {
  return getSetting("auth_user");
}

function hashPassword(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 64, { N: SCRYPT_N, r: 8, p: 1 });
}

export function setCredentials(username: string, password: string) {
  const salt = crypto.randomBytes(16);
  const hash = hashPassword(password, salt);
  setSetting("auth_user", username.trim());
  setSetting("auth_hash", `${salt.toString("hex")}:${hash.toString("hex")}`);
  // Bestehende Sitzungen entwerten — ein Passwortwechsel soll überall wirken
  setSetting("auth_secret", crypto.randomBytes(32).toString("hex"));
}

export function disableAuth() {
  deleteSetting("auth_user");
  deleteSetting("auth_hash");
  deleteSetting("auth_secret");
}

export function verifyPassword(username: string, password: string): boolean {
  const user = getSetting("auth_user");
  const stored = getSetting("auth_hash");
  if (!user || !stored) return false;

  // Benutzername ebenfalls zeitkonstant vergleichen, damit er sich nicht
  // über Antwortzeiten erraten lässt
  const userOk = timingSafeEqualStr(user, username.trim());

  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  let actual: Buffer;
  try {
    actual = hashPassword(password, Buffer.from(saltHex, "hex"));
  } catch {
    return false;
  }
  const passOk = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  return userOk && passOk;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sessionSecret(): string {
  let s = getSetting("auth_secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("auth_secret", s);
  }
  return s;
}

/** Signiertes Token: <expiry>.<hmac>. Kein Server-State nötig. */
export function createSession(): { value: string; maxAge: number } {
  const expiry = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const mac = crypto.createHmac("sha256", sessionSecret()).update(String(expiry)).digest("hex");
  return { value: `${expiry}.${mac}`, maxAge: SESSION_DAYS * 24 * 3600 };
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [expiryStr, mac] = token.split(".");
  if (!expiryStr || !mac) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expected = crypto.createHmac("sha256", sessionSecret()).update(expiryStr).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Schutz gegen Durchprobieren ---------- */

/**
 * Fehlversuche im Speicher, nicht in der Datenbank.
 *
 * Bewusst flüchtig: Ein Neustart hebt die Sperre auf. Für eine selbstgehostete
 * Einzelinstanz ist das der richtige Tausch — die Alternative wäre ein
 * Schreibzugriff pro Fehlversuch, womit das Durchprobieren erst recht zu einem
 * Weg würde, die Platte vollzuschreiben. Wer den Container neu starten kann,
 * kommt ohnehin direkt an die Datenbank.
 */
const failures = new Map<string, { count: number; until: number }>();

const FREE_TRIES = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

/** Verbleibende Sperrzeit in Sekunden; 0 = nicht gesperrt. */
export function loginLockSeconds(key: string): number {
  const f = failures.get(key);
  if (!f || Date.now() >= f.until) return 0;
  return Math.ceil((f.until - Date.now()) / 1000);
}

export function noteLoginFailure(key: string) {
  const f = failures.get(key) ?? { count: 0, until: 0 };
  f.count++;
  if (f.count > FREE_TRIES) {
    // Verdopplung ab dem ersten Versuch über der Freigrenze: 30s, 60s, 120s …
    const step = f.count - FREE_TRIES - 1;
    f.until = Date.now() + Math.min(BASE_LOCK_MS * 2 ** step, MAX_LOCK_MS);
  }
  failures.set(key, f);

  // Die Map selbst begrenzen: Ohne das wäre sie ein eigenes Angriffsziel —
  // beliebig viele Kennungen ergäben beliebig viele Einträge.
  if (failures.size > 1000) {
    const now = Date.now();
    for (const [k, v] of failures) if (v.until < now) failures.delete(k);
  }
}

export function noteLoginSuccess(key: string) {
  failures.delete(key);
}
