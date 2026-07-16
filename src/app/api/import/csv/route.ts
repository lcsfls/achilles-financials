import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { categorize } from "@/lib/categorize";

export const dynamic = "force-dynamic";

/** Minimaler CSV-Parser mit Quote-Unterstützung. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

const COL = {
  type: ["type", "typ"],
  completed: ["completed date", "abschlussdatum", "date completed"],
  started: ["started date", "startdatum"],
  description: ["description", "beschreibung"],
  amount: ["amount", "betrag"],
  currency: ["currency", "währung", "waehrung"],
  state: ["state", "status"],
  balance: ["balance", "kontostand", "saldo"],
};

function findCol(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h.trim().toLowerCase()));
}

/** Import eines Kontoauszugs im CSV-Format (getestet mit Revolut-Exporten, DE + EN). */
export async function POST(req: NextRequest) {
  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") return NextResponse.json({ error: "CSV-Inhalt fehlt" }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV enthält keine Datenzeilen" }, { status: 400 });

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const iCompleted = findCol(header, COL.completed);
  const iStarted = findCol(header, COL.started);
  const iDesc = findCol(header, COL.description);
  const iAmount = findCol(header, COL.amount);
  const iCurrency = findCol(header, COL.currency);
  const iState = findCol(header, COL.state);
  const iBalance = findCol(header, COL.balance);

  if (iAmount === -1 || (iCompleted === -1 && iStarted === -1)) {
    return NextResponse.json({ error: "Das sieht nicht nach einem Kontoauszug-CSV aus (Spalten „Amount“/„Completed Date“ bzw. „Betrag“/„Abschlussdatum“ fehlen)." }, { status: 400 });
  }

  const d = db();
  const accountId = "csv-import";
  let imported = 0;
  let skipped = 0;
  let lastDate = "";
  let lastBalance: number | null = null;
  let currency = "EUR";

  const upsert = d.prepare(
    `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       category = CASE WHEN transactions.category_locked = 1 THEN transactions.category ELSE excluded.category END`
  );

  const run = d.transaction(() => {
    d.prepare(
      `INSERT INTO accounts (id, provider, name, iban, currency, balance, last_synced)
       VALUES (?, 'csv', 'Konto (CSV-Import)', NULL, 'EUR', 0, ?)
       ON CONFLICT(id) DO NOTHING`
    ).run(accountId, new Date().toISOString());

    for (const row of rows.slice(1)) {
      const state = iState !== -1 ? row[iState]?.trim().toUpperCase() : "COMPLETED";
      if (state && state !== "COMPLETED" && state !== "ABGESCHLOSSEN") { skipped++; continue; }

      const rawDate = (iCompleted !== -1 && row[iCompleted]) || (iStarted !== -1 && row[iStarted]) || "";
      const date = rawDate.trim().slice(0, 10);
      const amount = parseFloat((row[iAmount] || "").replace(",", "."));
      if (!date || Number.isNaN(amount)) { skipped++; continue; }

      const desc = iDesc !== -1 ? (row[iDesc] || "").trim() : "";
      if (iCurrency !== -1 && row[iCurrency]) currency = row[iCurrency].trim();

      const id = "csv-" + crypto.createHash("sha1").update(`${date}|${amount}|${desc}|${row[iBalance] ?? ""}`).digest("hex").slice(0, 24);
      upsert.run(id, accountId, date, amount, currency, desc || null, desc || null, categorize(desc, desc, amount));
      imported++;

      if (date >= lastDate && iBalance !== -1 && row[iBalance]) {
        const bal = parseFloat(row[iBalance].replace(",", "."));
        if (!Number.isNaN(bal)) { lastDate = date; lastBalance = bal; }
      }
    }

    d.prepare(
      `UPDATE accounts SET currency = ?, balance = COALESCE(?, balance), last_synced = ? WHERE id = ?`
    ).run(currency, lastBalance, new Date().toISOString(), accountId);
  });
  run();

  return NextResponse.json({ ok: true, imported, skipped, balance: lastBalance });
}
