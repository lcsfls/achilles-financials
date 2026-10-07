import fs from "node:fs";

/**
 * The money logic behind cash flow, budgets and recurring payments — checked
 * against a small, hand-made ledger where every expected figure can be worked
 * out on paper.
 */

const DIR = "/tmp/finance-test";
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.DATA_DIR = DIR;

let ok = 0, fail = 0;
const check = (n: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got) === JSON.stringify(want);
  g ? ok++ : fail++;
  console.log(`  ${g ? "✓" : "✗"} ${n.padEnd(58)} ${JSON.stringify(got)}${g ? "" : ` (erwartet ${JSON.stringify(want)})`}`);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const { db } = await import("../src/lib/server/db");
  const { computeCashflow } = await import("../src/lib/server/cashflow");
  const { budgetOverview, setBudget } = await import("../src/lib/server/budgets");
  const { detectRecurring, merchantKey } = await import("../src/lib/server/recurring");
  const d = db();

  d.prepare("INSERT INTO accounts (id, provider, name, currency, balance) VALUES ('a', 'manual', 'Test', 'EUR', 0)").run();
  let n = 0;
  const tx = (date: string, amount: number, category: string, merchant = "X") =>
    d.prepare("INSERT INTO transactions (id, account_id, booking_date, amount, category, merchant) VALUES (?, 'a', ?, ?, ?, ?)")
      .run(`t${n++}`, date, amount, category, merchant);

  // March 2026: salary 3000, rent 1000, groceries 300 with a 20 refund in
  // Shopping against 100 spent, 500 into a savings plan, 200 moved between
  // own accounts (must be ignored).
  tx("2026-03-01", 3000, "Gehalt & Einnahmen", "Arbeitgeber");
  tx("2026-03-01", -1000, "Wohnen & Nebenkosten", "Vermieter");
  tx("2026-03-05", -300, "Lebensmittel", "REWE");
  tx("2026-03-07", -100, "Shopping", "Laden");
  tx("2026-03-09", 20, "Shopping", "Laden");
  tx("2026-03-10", -500, "Investments", "Broker");
  tx("2026-03-12", -200, "Überweisungen", "Ich selbst");
  // February: only groceries, for the comparison and the rollover.
  tx("2026-02-10", -250, "Lebensmittel", "REWE");

  console.log("=== Cashflow März");
  const cf = computeCashflow("2026-03-01", "2026-03-31", { from: "2026-02-01", to: "2026-02-28" });
  check("Einnahmen = Gehalt", cf.totals.income, 3000);
  check("Ausgaben netto (Erstattung mindert Shopping)", cf.totals.expenses, 1380);
  check("Investiert separat", cf.totals.invested, 500);
  check("Gespart = Rest", cf.totals.saved, 1120);
  check("Bilanz geht auf (links = rechts)", r2(cf.sources.reduce((s, x) => s + x.value, 0)), r2(cf.totals.expenses + cf.invested + cf.saved));
  check("Überweisungen ausgeklammert", cf.excludedTransfers, 200);
  check("Shopping netto 80", cf.expenses.find((e) => e.category === "Shopping")?.value, 80);
  check("Vormonat Lebensmittel", cf.expenses.find((e) => e.category === "Lebensmittel")?.prev, 250);

  console.log("=== Cashflow im Minus");
  const minus = computeCashflow("2026-02-01", "2026-02-28");
  check("Defizit als Quelle „Aus Rücklagen“", minus.sources.map((s) => [s.kind, s.value]), [["deficit", 250]]);
  check("Einnahmen bleiben 0, nicht negativ", minus.totals.income, 0);

  console.log("=== Budgets mit Übertrag");
  // Created in February: 400 for groceries with rollover → 150 left in Feb.
  setBudget("Lebensmittel", 400, true);
  d.prepare("UPDATE budgets SET created_month = '2026-02'").run();
  const b = budgetOverview("2026-03");
  const groceries = b.budgets.find((x) => x.category === "Lebensmittel")!;
  check("Übertrag aus Februar", groceries.carry, 150);
  check("verfügbar März = 400 + 150", groceries.available, 550);
  check("ausgegeben März", groceries.spent, 300);
  check("Status vergangener Monat im Plan", groceries.status, "ok");
  check("Miete ohne Budget gelistet", b.unbudgeted.map((u) => u.category).includes("Wohnen & Nebenkosten"), true);
  check("Gehalt nie budgetierbar", b.unbudgeted.some((u) => u.category === "Gehalt & Einnahmen"), false);

  console.log("=== Wiederkehrende Zahlungen");
  const book = (date: string, amount: number, merchant: string, category = "Abos & Dienste") => ({ date, amount, merchant, description: null, category });
  const today = new Date("2026-06-20");
  const found = detectRecurring([
    // Monthly, same day, price rise in May
    book("2026-01-15", -9.99, "Streaming 4711"), book("2026-02-15", -9.99, "Streaming 4712"),
    book("2026-03-15", -9.99, "Streaming 4713"), book("2026-04-15", -9.99, "Streaming 4714"),
    book("2026-05-15", -12.99, "Streaming 4715"), book("2026-06-15", -12.99, "Streaming 4716"),
    // Supermarket: frequent but irregular amounts and gaps — not a subscription
    book("2026-05-02", -43, "Markt", "Lebensmittel"), book("2026-05-04", -12, "Markt", "Lebensmittel"),
    book("2026-05-11", -88, "Markt", "Lebensmittel"), book("2026-05-30", -25, "Markt", "Lebensmittel"),
    // Quarterly fee
    book("2025-12-15", -55.08, "Beitrag"), book("2026-03-15", -55.08, "Beitrag"), book("2026-06-15", -55.08, "Beitrag"),
    // Stopped in February
    book("2025-11-03", -5, "Altes Abo"), book("2025-12-03", -5, "Altes Abo"), book("2026-01-03", -5, "Altes Abo"), book("2026-02-03", -5, "Altes Abo"),
  ], today);
  const byName = (k: string) => found.find((f) => f.key === merchantKey(k, null));
  check("Referenznummern ignoriert (ein Empfänger)", merchantKey("Streaming 4711", null) === merchantKey("STREAMING 4716", null), true);
  check("Streaming monatlich erkannt", byName("Streaming")?.frequency, "monthly");
  check("Preiserhöhung 9,99 → 12,99", byName("Streaming")?.priceChange && [byName("Streaming")!.priceChange!.from, byName("Streaming")!.priceChange!.to], [9.99, 12.99]);
  check("nächste Abbuchung am selben Tag", byName("Streaming")?.nextDate, "2026-07-15");
  check("Supermarkt ist kein Abo", byName("Markt"), undefined);
  check("Beitrag vierteljährlich, 18,36/Monat", [byName("Beitrag")?.frequency, r2(byName("Beitrag")?.monthly ?? 0)], ["quarterly", 18.36]);
  check("Altes Abo als beendet markiert", byName("Altes Abo")?.active, false);

  console.log(`\n  ${ok} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
}

main();
