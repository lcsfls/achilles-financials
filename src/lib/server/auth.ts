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
/** Settings key holding the ids of the sessions that are still valid. */
const SESSIONS_KEY = "auth_sessions";
/** Signed-in devices kept at once; the oldest is dropped beyond that. */
const MAX_SESSIONS = 20;

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
  deleteSetting(SESSIONS_KEY);
}

export function disableAuth() {
  deleteSetting("auth_user");
  deleteSetting("auth_hash");
  deleteSetting("auth_secret");
  deleteSetting(SESSIONS_KEY);
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

/** Valid session ids with their expiry, expired ones dropped. */
function liveSessions(): Record<string, number> {
  let all: Record<string, number> = {};
  try { all = JSON.parse(getSetting(SESSIONS_KEY) ?? "{}"); } catch { /* treat as none */ }
  const now = Date.now();
  return Object.fromEntries(Object.entries(all).filter(([, exp]) => typeof exp === "number" && exp > now));
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/**
 * Signed token: <expiry>.<id>.<hmac>.
 *
 * The id is also stored on the server, so signing out really ends the session.
 * A signature alone would stay valid until it expires, which made a copied
 * cookie usable for 30 days after "Logout".
 */
export function createSession(): { value: string; maxAge: number } {
  const expiry = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const id = crypto.randomBytes(16).toString("hex");

  const sessions = liveSessions();
  sessions[id] = expiry;
  const kept = Object.entries(sessions).sort((x, y) => y[1] - x[1]).slice(0, MAX_SESSIONS);
  setSetting(SESSIONS_KEY, JSON.stringify(Object.fromEntries(kept)));

  return { value: `${expiry}.${id}.${sign(`${expiry}.${id}`)}`, maxAge: SESSION_DAYS * 24 * 3600 };
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [expiryStr, id, mac] = token.split(".");
  if (!expiryStr || !id || !mac) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  if (!timingSafeEqualStr(mac, sign(`${expiryStr}.${id}`))) return false;
  return id in liveSessions();
}

/** End one session (sign-out). Unknown or malformed tokens are ignored. */
export function revokeSession(token: string | undefined) {
  const id = token?.split(".")[1];
  if (!id) return;
  const sessions = liveSessions();
  if (!(id in sessions)) return;
  delete sessions[id];
  setSetting(SESSIONS_KEY, JSON.stringify(sessions));
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
