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
