import { db } from "./db";
import { EXCLUDED_CATEGORIES, INCOME_CATEGORY, groupOf } from "../cashflow";

export type BudgetStatus = "ok" | "warn" | "over";

export type BudgetRow = {
  category: string;
  group: string;
  amount: number;
  rollover: boolean;
  /** Left over (positive) or overspent (negative) from earlier months, with rollover on. */
  carry: number;
  /** amount + carry: what this month may actually use. */
  available: number;
  spent: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
};

export type BudgetOverview = {
  month: string;
  /** Share of the month already gone: 1 for past months, 0 for future ones. */
  pace: number;
  budgets: BudgetRow[];
  unbudgeted: Array<{ category: string; group: string; spent: number; suggestion: number }>;
  /** Average monthly spending of the last three full months — a starting point for new budgets. */
  suggestions: Record<string, number>;
  totals: { available: number; spent: number; remaining: number };
};

/** Categories a budget makes no sense for: income, transfers, investing. */
const NOT_BUDGETABLE = new Set([...EXCLUDED_CATEGORIES, INCOME_CATEGORY, "Investments"]);

export function isBudgetable(category: string) {
  return !NOT_BUDGETABLE.has(category);
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, days: last };
}

function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Net spending per category and month. Netting, as on the cash flow page: a
 * refund lowers what the category cost instead of counting as income.
 */
function spendingByMonth(from: string, to: string): Map<string, Map<string, number>> {
  const rows = db()
    .prepare(
      `SELECT strftime('%Y-%m', booking_date) AS month, category, SUM(amount) AS net
         FROM transactions
        WHERE pending = 0 AND booking_date >= ? AND booking_date <= ?
        GROUP BY month, category`
    )
    .all(from, to) as Array<{ month: string; category: string; net: number }>;
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!isBudgetable(r.category)) continue;
    const m = out.get(r.month) ?? new Map<string, number>();
    m.set(r.category, Math.max(0, -r.net));
    out.set(r.month, m);
  }
  return out;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function budgetOverview(month: string): BudgetOverview {
  const { to, days } = monthBounds(month);
  const now = currentMonth();
  const pace = month < now ? 1 : month > now ? 0 : new Date().getDate() / days;

  const budgets = db().prepare("SELECT * FROM budgets").all() as Array<{
    category: string; amount_eur: number; rollover: number; created_month: string;
  }>;

  // One query covering every month any rollover could reach back to, plus the
  // three months the suggestions are averaged over.
  const earliest = [addMonths(month, -3), ...budgets.filter((b) => b.rollover).map((b) => b.created_month)].sort()[0];
  const spending = spendingByMonth(`${earliest}-01`, to);
  const spentIn = (m: string, cat: string) => spending.get(m)?.get(cat) ?? 0;

  const rows: BudgetRow[] = budgets.map((b) => {
    let carry = 0;
    if (b.rollover) {
      // Every finished month since the budget exists hands its remainder on.
      for (let m = b.created_month; m < month; m = addMonths(m, 1)) carry += b.amount_eur - spentIn(m, b.category);
    }
    const available = b.amount_eur + carry;
    const spent = spentIn(month, b.category);
    const pct = available > 0 ? (spent / available) * 100 : spent > 0 ? 100 : 0;
    // "warn" near the limit, or when at least half is gone and spending runs
    // well ahead of the calendar — 70 % on the 10th is the moment to notice,
    // not the 28th. The 50 % floor keeps a gym fee debited on the 1st from
    // flagging a small budget as "too fast" on day two.
    const ahead = pace < 1 && pct >= 50 && pct > pace * 100 + 25;
    const status: BudgetStatus = spent > available ? "over" : pct >= 85 || ahead ? "warn" : "ok";
    return {
      category: b.category,
      group: groupOf(b.category),
      amount: b.amount_eur,
      rollover: b.rollover === 1,
      carry,
      available,
      spent,
      remaining: available - spent,
      pct,
      status,
    };
  });
  rows.sort((a, b) => b.available - a.available);

  // Suggestion: average of the last three full months, rounded up to 10 €.
  const suggestions: Record<string, number> = {};
  const lastThree = [1, 2, 3].map((i) => addMonths(month, -i));
  const cats = new Set<string>();
  for (const m of lastThree) for (const c of spending.get(m)?.keys() ?? []) cats.add(c);
  for (const c of cats) {
    const avg = lastThree.reduce((s, m) => s + spentIn(m, c), 0) / 3;
    if (avg > 0) suggestions[c] = Math.ceil(avg / 10) * 10;
  }

  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = [...(spending.get(month)?.entries() ?? [])]
    .filter(([c, v]) => !budgeted.has(c) && v > 0)
    .map(([category, spent]) => ({ category, group: groupOf(category), spent, suggestion: suggestions[category] ?? Math.ceil(spent / 10) * 10 }))
    .sort((a, b) => b.spent - a.spent);

  const totals = rows.reduce(
    (t, r) => ({ available: t.available + r.available, spent: t.spent + r.spent, remaining: t.remaining + r.remaining }),
    { available: 0, spent: 0, remaining: 0 }
  );

  return { month, pace, budgets: rows, unbudgeted, suggestions, totals };
}

export function setBudget(category: string, amount: number, rollover: boolean) {
  db()
    .prepare(
      `INSERT INTO budgets (category, amount_eur, rollover, created_month) VALUES (?, ?, ?, ?)
       ON CONFLICT(category) DO UPDATE SET amount_eur = excluded.amount_eur, rollover = excluded.rollover`
    )
    .run(category, amount, rollover ? 1 : 0, currentMonth());
}

export function deleteBudget(category: string) {
  db().prepare("DELETE FROM budgets WHERE category = ?").run(category);
}
