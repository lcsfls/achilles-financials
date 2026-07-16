import { NextResponse } from "next/server";
import { db, getSetting } from "@/lib/db";
import { getMetalHoldings } from "@/lib/metals";

export const dynamic = "force-dynamic";

export async function GET() {
  const d = db();

  const accounts = d.prepare("SELECT * FROM accounts").all() as Array<{ id: string; name: string; balance: number; currency: string; last_synced: string | null; iban: string | null }>;
  const cashTotal = accounts.reduce((s, a) => s + a.balance, 0);

  // Notgroschen ist zweckgebunden und zählt deshalb nicht als frei verfügbare
  // Liquidität — weder im FIRE-Startkapital noch als Sparpotenzial.
  const emergencyId = getSetting("emergency_account_id");
  const emergencyAccount = emergencyId ? accounts.find((a) => a.id === emergencyId) : undefined;
  const emergencyTarget = Number(getSetting("emergency_target_eur") || 0);
  // Ohne verknüpftes Konto zählt der manuell gepflegte Stand. Der ist aber
  // nicht Teil von cashTotal und darf deshalb dort auch nicht abgezogen werden.
  const emergencyManual = Number(getSetting("emergency_manual_balance") || 0);
  const emergencyBalance = emergencyAccount ? emergencyAccount.balance : emergencyManual;
  const emergencyInCash = emergencyAccount ? emergencyAccount.balance : 0;

  // Monatliche Ausgaben/Einnahmen der letzten 8 Monate
  const monthly = d
    .prepare(
      `SELECT strftime('%Y-%m', booking_date) AS month,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS earned
       FROM transactions
       WHERE booking_date >= date('now', '-8 months') AND pending = 0
       GROUP BY month ORDER BY month`
    )
    .all();

  // Kategorien im aktuellen Monat
  const thisMonthCats = d
    .prepare(
      `SELECT category, SUM(-amount) AS total, COUNT(*) AS count
       FROM transactions
       WHERE amount < 0 AND pending = 0 AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', 'now')
       GROUP BY category ORDER BY total DESC`
    )
    .all();

  const thisMonth = d
    .prepare(
      `SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS earned
       FROM transactions WHERE pending = 0 AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', 'now')`
    )
    .get() as { spent: number | null; earned: number | null };

  const lastMonth = d
    .prepare(
      `SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
       FROM transactions WHERE pending = 0 AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', 'now', '-1 month')`
    )
    .get() as { spent: number | null };

  const recent = d
    .prepare("SELECT * FROM transactions ORDER BY booking_date DESC, id DESC LIMIT 9")
    .all();

  // Durchschnitt über abgeschlossene Monate — der laufende Monat ist noch nicht
  // vorbei und würde den Schnitt nach unten ziehen.
  const avgRow = d
    .prepare(
      `SELECT AVG(spent) AS avg_spent FROM (
         SELECT strftime('%Y-%m', booking_date) AS m, SUM(-amount) AS spent
         FROM transactions
         WHERE amount < 0 AND pending = 0
           AND strftime('%Y-%m', booking_date) < strftime('%Y-%m', 'now')
           AND booking_date >= date('now', '-6 months')
         GROUP BY m
       )`
    )
    .get() as { avg_spent: number | null };

  // Wiederkehrende Fixkosten des laufenden Monats
  const fixedRow = d
    .prepare(
      `SELECT SUM(-amount) AS total FROM transactions
       WHERE amount < 0 AND pending = 0
         AND category IN ('Abos & Dienste', 'Wohnen & Nebenkosten')
         AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', 'now')`
    )
    .get() as { total: number | null };

  const largestRow = d
    .prepare(
      // ORDER BY auf die Spalte, nicht auf das Alias: 'amount' wäre sonst der
      // negierte Wert und würde die kleinste statt der größten Ausgabe liefern.
      `SELECT merchant, description, -amount AS amount FROM transactions
       WHERE amount < 0 AND pending = 0
         AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', 'now')
       ORDER BY transactions.amount ASC LIMIT 1`
    )
    .get() as { merchant: string | null; description: string | null; amount: number } | undefined;

  const txCount = (d.prepare("SELECT COUNT(*) AS c FROM transactions").get() as { c: number }).c;

  const metals = await getMetalHoldings().catch(() => ({ holdings: [], spot: [], totalValue: 0, totalCost: 0 }));

  const investments = d.prepare("SELECT * FROM investments").all() as Array<{ units: number; buy_price_eur: number; current_price_eur: number | null }>;
  const invValue = investments.reduce((s, i) => s + i.units * (i.current_price_eur ?? i.buy_price_eur), 0);
  const invCost = investments.reduce((s, i) => s + i.units * i.buy_price_eur, 0);

  const pensionRow = d
    .prepare("SELECT statement_date, balance_eur FROM pension_statements ORDER BY statement_date DESC LIMIT 1")
    .get() as { statement_date: string; balance_eur: number } | undefined;
  const pensionValue = pensionRow?.balance_eur ?? 0;

  return NextResponse.json({
    accounts,
    cashTotal,
    monthly,
    thisMonthCats,
    thisMonth: { spent: thisMonth.spent ?? 0, earned: thisMonth.earned ?? 0 },
    lastMonthSpent: lastMonth.spent ?? 0,
    stats: {
      // Sparquote nur bei vorhandenen Einnahmen — sonst wäre sie bedeutungslos
      savingsRatePct:
        (thisMonth.earned ?? 0) > 0
          ? (((thisMonth.earned ?? 0) - (thisMonth.spent ?? 0)) / (thisMonth.earned ?? 1)) * 100
          : null,
      cashflow: (thisMonth.earned ?? 0) - (thisMonth.spent ?? 0),
      avgSpent: avgRow.avg_spent,
      fixedCosts: fixedRow.total ?? 0,
      largestExpense: largestRow ?? null,
      topCategory: (thisMonthCats as Array<{ category: string; total: number }>)[0] ?? null,
      txCount,
    },
    recent,
    metals: { totalValue: metals.totalValue, totalCost: metals.totalCost, holdings: metals.holdings.map((h) => ({ metal: h.metal, name: h.name, color: h.color, totalGrams: h.totalGrams, currentValue: h.currentValue, totalCost: h.totalCost })) },
    investments: { value: invValue, cost: invCost, count: investments.length },
    pension: { value: pensionValue, lastDate: pensionRow?.statement_date ?? null },
    emergency:
      emergencyAccount || emergencyTarget > 0 || emergencyManual > 0
        ? {
            accountId: emergencyAccount?.id ?? null,
            accountName: emergencyAccount?.name ?? null,
            balance: emergencyBalance,
            target: emergencyTarget,
            pct: emergencyTarget > 0 ? Math.min(100, (emergencyBalance / emergencyTarget) * 100) : null,
          }
        : null,
    // Bausteine für das FIRE-Startkapital, einzeln wählbar
    assets: {
      cash: cashTotal - emergencyInCash,
      metals: metals.totalValue,
      investments: invValue,
      pension: pensionValue,
    },
    netWorth: cashTotal + metals.totalValue + invValue + pensionValue,
    demoMode: getSetting("demo_mode") === "1",
    lastSync: getSetting("eb_last_sync"),
    connected: getSetting("eb_auth_status") === "linked",
  });
}
