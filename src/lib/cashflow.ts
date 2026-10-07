/**
 * Cash flow: where the money of a period came from and where it went.
 *
 * Shared between the API (which computes the flows) and the page (which
 * labels and groups them), so both always agree on what a group contains.
 */

/** Categories folded into groups for the compact view of the diagram. */
export const CASHFLOW_GROUPS: Record<string, { label: string; color: string; categories: string[] }> = {
  fixed: { label: "Fixkosten", color: "#fd7e14", categories: ["Wohnen & Nebenkosten", "Abos & Dienste"] },
  living: { label: "Lebenshaltung", color: "#22a06b", categories: ["Lebensmittel", "Gesundheit", "Transport", "Bildung"] },
  leisure: { label: "Freizeit", color: "#e64980", categories: ["Restaurants & Cafés", "Reisen", "Unterhaltung", "Shopping"] },
  other: { label: "Sonstiges", color: "#868e96", categories: ["Bargeld", "Sonstiges", "Gehalt & Einnahmen", "Investments"] },
};

export function groupOf(category: string): string {
  for (const [key, g] of Object.entries(CASHFLOW_GROUPS)) if (g.categories.includes(category)) return key;
  return "other";
}

/**
 * Categories that never enter the diagram.
 *
 * Transfers are mostly money moving between your own accounts: counted, they
 * would appear once as income and once as spending and inflate both sides.
 */
export const EXCLUDED_CATEGORIES = ["Überweisungen"];

/** The income category whose bookings are split by sender for the left column. */
export const INCOME_CATEGORY = "Gehalt & Einnahmen";

export type CashflowSource = { key: string; label: string; value: number; kind: "income" | "refund" | "deficit" };
export type CashflowExpense = { category: string; group: string; value: number; prev: number };

export type Cashflow = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  sources: CashflowSource[];
  expenses: CashflowExpense[];
  invested: number;
  saved: number;
  totals: { income: number; expenses: number; invested: number; saved: number; savingsRatePct: number | null };
  prevTotals: { income: number; expenses: number; invested: number; saved: number };
  /** Sum of the transfers left out, so the page can say how much was excluded. */
  excludedTransfers: number;
  /** Earliest booking date, so the period picker knows where to stop. */
  firstDate: string | null;
};
