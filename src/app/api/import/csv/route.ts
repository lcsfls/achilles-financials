import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { categorize } from "@/lib/categorize";
import { CsvError, assertCsvSize, parseStatementCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * Import eines Kontoauszugs im CSV-Format.
 * Das Format wird erkannt, nicht vorausgesetzt — siehe src/lib/csv.ts.
 */
export async function POST(req: NextRequest) {
  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "CSV-Inhalt fehlt" }, { status: 400 });
  }

  let parsed;
  try {
    assertCsvSize(csv);
    parsed = parseStatementCsv(csv);
  } catch (e) {
    const msg = e instanceof CsvError ? e.message : "Die Datei konnte nicht gelesen werden.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const d = db();
  const accountId = "csv-import";
  let imported = 0;
  let lastDate = "";
  let lastBalance: number | null = null;
  let currency = "EUR";

  const upsert = d.prepare(
    `INSERT INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       pending = excluded.pending,
       category = CASE WHEN transactions.category_locked = 1 THEN transactions.category ELSE excluded.category END`
  );

  const run = d.transaction(() => {
    // Konto zuerst — die Transaktionen haben einen Fremdschlüssel darauf
    d.prepare(
      `INSERT INTO accounts (id, provider, name, iban, currency, balance, last_synced)
       VALUES (?, 'csv', 'Konto (CSV-Import)', NULL, 'EUR', 0, ?)
       ON CONFLICT(id) DO NOTHING`
    ).run(accountId, new Date().toISOString());

    for (const row of parsed.rows) {
      if (row.currency) currency = row.currency;
      const text = row.merchant ?? row.description ?? "";

      // Hash über die Buchungsmerkmale: derselbe Auszug lässt sich mehrfach
      // hochladen, ohne Dubletten zu erzeugen.
      const id =
        "csv-" +
        crypto.createHash("sha1")
          .update(`${row.date}|${row.amount}|${row.merchant ?? ""}|${row.description ?? ""}|${row.balance ?? ""}`)
          .digest("hex")
          .slice(0, 24);

      upsert.run(
        id, accountId, row.date, row.amount, row.currency || currency,
        row.merchant, row.description,
        categorize(row.merchant, row.description, row.amount),
        row.pending ? 1 : 0
      );
      imported++;

      if (row.date >= lastDate && row.balance !== null) {
        lastDate = row.date;
        lastBalance = row.balance;
      }
    }

    d.prepare("UPDATE accounts SET currency = ?, balance = COALESCE(?, balance), last_synced = ? WHERE id = ?")
      .run(currency, lastBalance, new Date().toISOString(), accountId);
  });
  run();

  return NextResponse.json({
    ok: true,
    imported,
    skipped: parsed.skipped,
    balance: lastBalance,
    // Zurückmelden, was erkannt wurde — bei einem unbekannten Export ist das
    // der einzige Weg zu sehen, ob die Zuordnung stimmt.
    detected: {
      delimiter: parsed.delimiter === "\t" ? "Tab" : parsed.delimiter,
      headerRow: parsed.headerRow + 1,
      mapping: parsed.mapping,
    },
  });
}
