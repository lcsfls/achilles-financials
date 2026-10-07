import { getSetting, setSetting } from "./db";
import { isConfigured, isEnabled } from "./integrations";

/**
 * Scheduled background sync.
 *
 * The binding constraint is not ours but PSD2's: for *unattended* access — the
 * customer isn't present — a provider may poll an account at most **four times
 * a day**, and individual banks cap it lower still. On top of that a consent
 * expires after 90 days and needs a fresh approval.
 *
 * So the shortest interval offered is 6 hours (= 4×/day, the legal ceiling),
 * and MIN_INTERVAL_MS enforces it server-side: a hand-edited setting cannot
 * push the app into calling the bank more often than it is allowed to.
 */
export type SyncInterval = "manual" | "6h" | "12h" | "24h" | "7d";

const HOURS = 3600_000;

export const INTERVALS: Record<Exclude<SyncInterval, "manual">, number> = {
  "6h": 6 * HOURS,
  "12h": 12 * HOURS,
  "24h": 24 * HOURS,
  "7d": 7 * 24 * HOURS,
};

/** Hard floor — 4×/day is what PSD2 permits unattended. */
export const MIN_INTERVAL_MS = 6 * HOURS;

export function isInterval(v: unknown): v is SyncInterval {
  return typeof v === "string" && (v === "manual" || v in INTERVALS);
}

export function getInterval(): SyncInterval {
  const v = getSetting("sync_interval");
  return isInterval(v) ? v : "24h"; // once a day: useful, and well inside the limit
}

/** When the automatic sync last ran (successfully or not — a failure must not spin). */
export function lastAutoSync(): string | null {
  return getSetting("sync_last_auto");
}

export function markAutoSync() {
  setSetting("sync_last_auto", new Date().toISOString());
}

/**
 * Is an automatic run due? Never returns true unless Enable Banking is enabled,
 * configured and actually linked — and never faster than the floor.
 */
export function isDue(now = Date.now()): boolean {
  const interval = getInterval();
  if (interval === "manual") return false;
  if (!isEnabled("enablebanking") || !isConfigured("enablebanking")) return false;
  if (getSetting("eb_auth_status") !== "linked") return false;

  const wait = Math.max(INTERVALS[interval], MIN_INTERVAL_MS);
  const last = lastAutoSync();
  if (!last) return true; // never ran — do it once, then the clock starts
  const elapsed = now - Date.parse(last);
  return Number.isFinite(elapsed) && elapsed >= wait;
}

/** Next due time, for showing "next run" in the UI. */
export function nextRun(): string | null {
  const interval = getInterval();
  if (interval === "manual") return null;
  const last = lastAutoSync();
  if (!last) return null;
  const wait = Math.max(INTERVALS[interval], MIN_INTERVAL_MS);
  return new Date(Date.parse(last) + wait).toISOString();
}
