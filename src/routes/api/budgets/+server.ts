import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { budgetOverview, currentMonth, deleteBudget, isBudgetable, setBudget } from "$lib/server/budgets";
import { CATEGORIES } from "$lib/categorize";

const MONTH = /^\d{4}-\d{2}$/;

export async function GET({ url }: RequestEvent) {
  const month = url.searchParams.get("month") ?? currentMonth();
  if (!MONTH.test(month)) return json({ error: "Monat ungültig — erwartet JJJJ-MM." }, { status: 400 });
  return json(budgetOverview(month));
}

/** Create or change a budget: { category, amount, rollover }. */
export async function PUT({ request }: RequestEvent) {
  const { category, amount, rollover } = await request.json();
  const cat = String(category ?? "");
  if (!(CATEGORIES as readonly string[]).includes(cat) || !isBudgetable(cat)) {
    return json({ error: "Für diese Kategorie gibt es kein Budget." }, { status: 400 });
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return json({ error: "Betrag muss größer als 0 sein." }, { status: 400 });
  setBudget(cat, Math.round(value * 100) / 100, Boolean(rollover));
  return json({ ok: true });
}

export async function DELETE({ url }: RequestEvent) {
  const cat = url.searchParams.get("category");
  if (!cat) return json({ error: "category erforderlich" }, { status: 400 });
  deleteBudget(cat);
  return json({ ok: true });
}
