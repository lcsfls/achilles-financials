import fs from "node:fs";

/**
 * Voller Umlauf: Backup ziehen, Daten verändern, wiederherstellen, vergleichen.
 * "Kein Fehler" reicht nicht — es muss beweisbar derselbe Stand herauskommen.
 */

const DIR = "/tmp/bk-test";
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.DATA_DIR = DIR;

let ok = 0, fail = 0;
const check = (n: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got) === JSON.stringify(want);
  g ? ok++ : fail++;
  console.log(`  ${g ? "✓" : "✗"} ${n.padEnd(52)} ${JSON.stringify(got)}${g ? "" : ` (erwartet ${JSON.stringify(want)})`}`);
};

async function main() {
  const { db } = await import("../src/lib/server/db");
  const { createBackup, restoreBackup } = await import("../src/lib/server/backup");
  const d = db();

  // Ausgangsdaten mit einer echten Fremdschlüsselbeziehung anlegen —
  // genau die hat den Fehler ausgelöst.
  d.prepare("INSERT INTO accounts (id, provider, name, currency, balance) VALUES ('a1', 'manual', 'Testkonto', 'EUR', 500)").run();
  d.prepare("INSERT INTO transactions (id, account_id, booking_date, amount, category) VALUES ('t1', 'a1', '2026-07-01', -25, 'Lebensmittel')").run();
  d.prepare("INSERT INTO transactions (id, account_id, booking_date, amount, category) VALUES ('t2', 'a1', '2026-07-02', 100, 'Einkommen')").run();
  const info = d.prepare("INSERT INTO pension_contracts (label, kind, created_at) VALUES ('Vertrag', 'pension', '2026-01-01')").run();
  d.prepare("INSERT INTO pension_statements (contract_id, statement_date, balance_eur) VALUES (?, '2026-01-01', 1234.5)").run(info.lastInsertRowid);

  const snapshot = () => ({
    konten: d.prepare("SELECT id, name, balance FROM accounts ORDER BY id").all(),
    buchungen: d.prepare("SELECT id, account_id, amount, category FROM transactions ORDER BY id").all(),
    vertraege: d.prepare("SELECT label FROM pension_contracts ORDER BY id").all(),
    auszuege: d.prepare("SELECT balance_eur FROM pension_statements ORDER BY id").all(),
  });

  const vorher = snapshot();
  console.log("=== Ausgangsstand");
  check("Konten", (vorher.konten as unknown[]).length, 1);
  check("Buchungen", (vorher.buchungen as unknown[]).length, 2);
  check("Vorsorgeverträge", (vorher.vertraege as unknown[]).length, 1);

  console.log("=== Backup erzeugen");
  const pw = "ein-langes-test-passwort";
  const blob = await createBackup(pw);
  check("Backup ist nicht leer", blob.length > 1000, true);
  check("Magic-Header", Buffer.from(blob).subarray(0, 12).toString(), "ACHILLESBAK1");

  console.log("=== Daten zerstören");
  d.prepare("DELETE FROM transactions").run();
  d.prepare("UPDATE accounts SET name = 'Kaputt', balance = 0").run();
  d.prepare("DELETE FROM pension_statements").run();
  d.prepare("INSERT INTO accounts (id, provider, name, currency, balance) VALUES ('zz', 'manual', 'Überzählig', 'EUR', 9)").run();
  check("Buchungen weg", (d.prepare("SELECT COUNT(*) c FROM transactions").get() as { c: number }).c, 0);
  check("Konto verfälscht", (d.prepare("SELECT name FROM accounts WHERE id='a1'").get() as { name: string }).name, "Kaputt");

  console.log("=== Wiederherstellen");
  const result = await restoreBackup(Buffer.from(blob), pw);
  check("Tabellen zurückgespielt", (result.tables as number) > 5, true);

  const nachher = snapshot();
  console.log("=== Stand identisch zum Ausgangspunkt?");
  check("Konten", nachher.konten, vorher.konten);
  check("Buchungen", nachher.buchungen, vorher.buchungen);
  check("Vorsorgeverträge", nachher.vertraege, vorher.vertraege);
  check("Auszüge", nachher.auszuege, vorher.auszuege);
  check("überzähliges Konto entfernt", (d.prepare("SELECT COUNT(*) c FROM accounts WHERE id='zz'").get() as { c: number }).c, 0);

  console.log("=== Fremdschlüsselprüfung danach wieder aktiv");
  check("foreign_keys", d.pragma("foreign_keys", { simple: true }), 1);
  check("keine verwaisten Buchungen", (d.prepare("SELECT COUNT(*) c FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id WHERE a.id IS NULL").get() as { c: number }).c, 0);

  console.log("=== Falsches Passwort wird abgewiesen");
  const { BackupError } = await import("../src/lib/server/backup");
  try {
    await restoreBackup(Buffer.from(blob), "falsch");
    check("abgelehnt", false, true);
  } catch (e) {
    // Die Route unterscheidet per instanceof zwischen HTTP 400 und 500
    check("als BackupError erkannt (→ HTTP 400)", e instanceof BackupError, true);
    check("Fehlerklasse im Log erkennbar", (e as Error).name, "BackupError");
  }

  console.log("=== Datenbank nach dem Fehlversuch unverändert");
  check("Buchungen weiterhin da", snapshot().buchungen, vorher.buchungen);
  check("Konten weiterhin da", snapshot().konten, vorher.konten);

  console.log(`\n  ${ok} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
}

main();
