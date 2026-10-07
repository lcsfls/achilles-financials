import { db } from "./db";
import { EXCLUDED_CATEGORIES } from "../cashflow";

export type Frequency = "weekly" | "monthly" | "quarterly" | "halfyearly" | "yearly";

export type Recurring = {
  key: string;
  merchant: string;
  category: string;
  frequency: Frequency;
  /** Median of the bookings, positive. */
  amount: number;
  lastAmount: number;
  /** The latest price change within the last 6 months, when it is more than rounding. */
  priceChange: { from: number; to: number; pct: number; since: string } | null;
  /** A savings plan (category Investments) — recurring, but not a cost. */
  savings: boolean;
  monthly: number;
  yearly: number;
  count: number;
  firstDate: string;
  lastDate: string;
  nextDate: string;
  /** Overdue by more than half an interval — probably cancelled. */
  active: boolean;
};

/** Interval in days and how far a single gap may stray from it. */
const PATTERNS: Array<{ frequency: Frequency; days: number; months: number; tolerance: number; perYear: number; minCount: number }> = [
  { frequency: "weekly", days: 7, months: 0, tolerance: 2, perYear: 52, minCount: 4 },
  { frequency: "monthly", days: 30.4, months: 1, tolerance: 5, perYear: 12, minCount: 3 },
  { frequency: "quarterly", days: 91, months: 3, tolerance: 12, perYear: 4, minCount: 2 },
  { frequency: "halfyearly", days: 182, months: 6, tolerance: 20, perYear: 2, minCount: 2 },
  { frequency: "yearly", days: 365, months: 12, tolerance: 25, perYear: 1, minCount: 2 },
];

/**
 * The next expected date. Calendar months, not a fixed number of days: rent
 * on the 1st is next due on the 1st, not "30.4 days later".
 */
function nextDue(last: string, p: (typeof PATTERNS)[number]): string {
  if (p.months === 0) return new Date(Date.parse(last) + p.days * DAY).toISOString().slice(0, 10);
  const [y, m, d] = last.split("-").map(Number);
  const lastOfTarget = new Date(Date.UTC(y, m - 1 + p.months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + p.months, Math.min(d, lastOfTarget))).toISOString().slice(0, 10);
}

/**
 * One key per payee, robust against what banks append: reference numbers,
 * dates, contract IDs. "Netflix.com 1234567" and "NETFLIX.COM 7654321" are
 * the same subscription.
 */
export function merchantKey(merchant: string | null, description: string | null) {
  return (merchant || description || "")
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-zäöüß&.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const DAY = 86400_000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type Booking = { date: string; amount: number; merchant: string | null; description: string | null; category: string };

/**
 * Find recurring outgoing payments.
 *
 * A payee counts when its bookings come at a steady interval (most gaps within
 * the tolerance of one pattern) and at a steady amount (most within 20 % of the
 * median). Both conditions matter: the supermarket is frequent but irregular,
 * a one-off at the same shop twice is regular but not frequent enough.
 */
export function detectRecurring(bookings: Booking[], today = new Date()): Recurring[] {
  const byKey = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.amount >= 0 || EXCLUDED_CATEGORIES.includes(b.category)) continue;
    const key = merchantKey(b.merchant, b.description);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), b]);
  }

  const out: Recurring[] = [];
  for (const [key, list] of byKey) {
    // Several bookings on one day (split charges) count as one.
    const days = new Map<string, number>();
    for (const b of list) days.set(b.date, (days.get(b.date) ?? 0) - b.amount);
    const series = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (series.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 1; i < series.length; i++) gaps.push((Date.parse(series[i][0]) - Date.parse(series[i - 1][0])) / DAY);
    const gap = median(gaps);
    const pattern = PATTERNS.find((p) => Math.abs(gap - p.days) <= p.tolerance);
    if (!pattern || series.length < pattern.minCount) continue;

    const steadyGaps = gaps.filter((g) => Math.abs(g - pattern.days) <= pattern.tolerance).length / gaps.length;
    if (steadyGaps < 0.7) continue;

    // Steady amount = each booking close to the one before. Measured pairwise,
    // not against the median: a price rise is one step, after which the new
    // amount is steady again — compared with the median, a subscription would
    // vanish from the list exactly when it got more expensive.
    const amounts = series.map(([, a]) => a);
    const typical = median(amounts);
    let steadyPairs = 0;
    for (let i = 1; i < amounts.length; i++) if (Math.abs(amounts[i] - amounts[i - 1]) <= amounts[i - 1] * 0.2) steadyPairs++;
    if (steadyPairs / (amounts.length - 1) < 0.7) continue;

    const last = series[series.length - 1];
    // Walk back to the last booking at a different price: a raise three months
    // ago is still news, and comparing only the last two bookings misses it.
    let priceChange: Recurring["priceChange"] = null;
    for (let i = series.length - 2; i >= 0; i--) {
      const diff = (last[1] - series[i][1]) / series[i][1];
      if (Math.abs(diff) >= 0.02) {
        const since = series[i + 1][0];
        if (today.getTime() - Date.parse(since) <= 183 * DAY) priceChange = { from: series[i][1], to: last[1], pct: diff * 100, since };
        break;
      }
    }
    const nextDate = nextDue(last[0], pattern);
    const overdue = (today.getTime() - Date.parse(nextDate)) / DAY;

    // Most recent booking's own label reads best ("Netflix", not "netflix").
    const latest = list.reduce((a, b) => (b.date > a.date ? b : a));
    out.push({
      key,
      merchant: latest.merchant || latest.description || key,
      category: latest.category,
      frequency: pattern.frequency,
      amount: typical,
      lastAmount: last[1],
      priceChange,
      savings: latest.category === "Investments",
      monthly: (last[1] * pattern.perYear) / 12,
      yearly: last[1] * pattern.perYear,
      count: series.length,
      firstDate: series[0][0],
      lastDate: last[0],
      nextDate,
      active: overdue <= pattern.days / 2,
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/** Recurring payments from the last 13 months, minus what the user dismissed. */
export function listRecurring() {
  const since = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);
  const rows = db()
    .prepare(
      `SELECT booking_date AS date, amount, merchant, description, category
         FROM transactions WHERE pending = 0 AND amount < 0 AND booking_date >= ?`
    )
    .all(since) as Booking[];
  const ignored = new Set(
    (db().prepare("SELECT merchant_key FROM recurring_ignored").all() as Array<{ merchant_key: string }>).map((r) => r.merchant_key)
  );
  const all = detectRecurring(rows);
  return {
    recurring: all.filter((r) => !ignored.has(r.key)),
    ignored: all.filter((r) => ignored.has(r.key)),
  };
}

export function setIgnored(key: string, ignored: boolean) {
  if (ignored) db().prepare("INSERT OR REPLACE INTO recurring_ignored (merchant_key, ignored_at) VALUES (?, ?)").run(key, new Date().toISOString());
  else db().prepare("DELETE FROM recurring_ignored WHERE merchant_key = ?").run(key);
}
