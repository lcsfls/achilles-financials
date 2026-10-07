import { db } from "./db";
import { EXCLUDED_CATEGORIES, INCOME_CATEGORY, groupOf, type Cashflow, type CashflowExpense, type CashflowSource } from "../cashflow";

type Row = { category: string; amount: number; merchant: string | null; description: string | null };

/** How many income senders get their own band before the rest is pooled. */
const MAX_SOURCES = 5;

function rows(from: string, to: string): Row[] {
  return db()
    .prepare(
      `SELECT category, amount, merchant, description FROM transactions
        WHERE pending = 0 AND booking_date >= ? AND booking_date <= ?`
    )
    .all(from, to) as Row[];
}

/**
 * Net per category, with "Investments" pulled out.
 *
 * Netting, not separate sums: a refund in Shopping reduces what Shopping cost,
 * it is not income. Only where a category ends up positive overall (more came
 * back than went out) does it appear as a source on the left.
 */
function aggregate(list: Row[]) {
  const net = new Map<string, number>();
  const senders = new Map<string, number>();
  let excludedTransfers = 0;
  let investedOut = 0;
  let investedIn = 0;

  for (const r of list) {
    if (EXCLUDED_CATEGORIES.includes(r.category)) {
      excludedTransfers += Math.abs(r.amount);
      continue;
    }
    if (r.category === "Investments") {
      if (r.amount < 0) investedOut += -r.amount;
      else investedIn += r.amount;
      continue;
    }
    if (r.category === INCOME_CATEGORY && r.amount > 0) {
      const who = (r.merchant || r.description || "—").trim();
      senders.set(who, (senders.get(who) ?? 0) + r.amount);
      continue;
    }
    net.set(r.category, (net.get(r.category) ?? 0) + r.amount);
  }
  return { net, senders, excludedTransfers, investedOut, investedIn };
}

/**
 * prev: the period to compare against. For calendar periods the page passes
 * the previous month/quarter/year (August against September, not "the 30
 * days before"); otherwise the same number of days just before `from`.
 */
export function computeCashflow(from: string, to: string, compareTo?: { from: string; to: string }): Cashflow {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400_000) + 1;
  const prevTo = compareTo?.to ?? new Date(Date.parse(from) - 86400_000).toISOString().slice(0, 10);
  const prevFrom = compareTo?.from ?? new Date(Date.parse(from) - days * 86400_000).toISOString().slice(0, 10);

  const cur = aggregate(rows(from, to));
  const prev = aggregate(rows(prevFrom, prevTo));

  // Left column: senders of income, largest first, the tail pooled.
  const senders = [...cur.senders.entries()].sort((a, b) => b[1] - a[1]);
  const sources: CashflowSource[] = senders
    .slice(0, MAX_SOURCES)
    .map(([label, value]) => ({ key: `in:${label}`, label, value, kind: "income" as const }));
  const rest = senders.slice(MAX_SOURCES).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) sources.push({ key: "in:other", label: "Sonstige Einnahmen", value: rest, kind: "income" });

  // Money taken back out of investments is money available to spend.
  const net = (cur.investedIn - cur.investedOut);
  if (net > 0) sources.push({ key: "in:investments", label: "Aus Investments", value: net, kind: "income" });

  const expenses: CashflowExpense[] = [];
  for (const [category, value] of cur.net) {
    if (value < 0) {
      expenses.push({ category, group: groupOf(category), value: -value, prev: Math.max(0, -(prev.net.get(category) ?? 0)) });
    } else if (value > 0) {
      sources.push({ key: `refund:${category}`, label: category, value, kind: "refund" });
    }
  }
  // Categories that had spending only in the previous period still belong in
  // the comparison table.
  for (const [category, value] of prev.net) {
    if (value < 0 && !cur.net.has(category)) expenses.push({ category, group: groupOf(category), value: 0, prev: -value });
  }
  expenses.sort((a, b) => b.value - a.value || b.prev - a.prev);

  const invested = Math.max(0, cur.investedOut - cur.investedIn);
  const income = sources.reduce((s, x) => s + x.value, 0);
  const spent = expenses.reduce((s, x) => s + x.value, 0);
  const balance = income - spent - invested;

  // A period in the red is paid from savings — shown as a source, so both
  // sides of the diagram still add up.
  if (balance < 0) sources.push({ key: "deficit", label: "Aus Rücklagen", value: -balance, kind: "deficit" });

  const prevIncome = [...prev.senders.values()].reduce((s, v) => s + v, 0)
    + [...prev.net.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0)
    + Math.max(0, prev.investedIn - prev.investedOut);
  const prevSpent = [...prev.net.values()].filter((v) => v < 0).reduce((s, v) => s - v, 0);
  const prevInvested = Math.max(0, prev.investedOut - prev.investedIn);

  const first = db().prepare("SELECT MIN(booking_date) AS d FROM transactions").get() as { d: string | null };
  // `income` was summed before the deficit source was added — real income only.
  const incomeOnly = income;

  return {
    from,
    to,
    prevFrom,
    prevTo,
    sources,
    expenses,
    invested,
    saved: Math.max(0, balance),
    totals: {
      income: incomeOnly,
      expenses: spent,
      invested,
      saved: balance,
      savingsRatePct: incomeOnly > 0 ? (balance / incomeOnly) * 100 : null,
    },
    prevTotals: { income: prevIncome, expenses: prevSpent, invested: prevInvested, saved: prevIncome - prevSpent - prevInvested },
    excludedTransfers: cur.excludedTransfers,
    firstDate: first.d,
  };
}
