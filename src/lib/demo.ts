import { db, deleteSetting, getSetting, setSetting } from "./db";
import { categorize } from "./categorize";

/** Seed realistischer Demo-Daten, solange noch keine Bank verbunden ist. */
export function seedDemoData() {
  const d = db();
  const now = new Date();

  d.prepare("INSERT OR REPLACE INTO accounts (id, provider, name, iban, currency, balance, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "demo-main",
    "demo",
    "Hauptkonto (Demo)",
    "LT12 3250 0000 0000 0000",
    "EUR",
    8432.17,
    now.toISOString()
  );

  const merchants: Array<[string, string, number, number]> = [
    // [merchant, desc, typischer Betrag, Häufigkeit pro Monat]
    ["REWE", "REWE SAGT DANKE", -42, 6],
    ["EDEKA", "EDEKA Einkauf", -31, 4],
    ["Lidl", "Lidl sagt Danke", -24, 3],
    ["Amazon", "AMZN Mktp DE", -54, 3],
    ["Zalando", "Zalando SE", -89, 0.6],
    ["Netflix", "NETFLIX.COM", -17.99, 1],
    ["Spotify", "Spotify AB", -11.99, 1],
    ["Apple", "APPLE.COM/BILL", -2.99, 1],
    ["Telekom", "Telekom Mobilfunk", -39.95, 1],
    ["Shell", "Shell Tankstelle", -68, 2],
    ["Deutsche Bahn", "DB Vertrieb GmbH", -49, 1.2],
    ["Uber", "Uber BV", -18, 1.5],
    ["Lieferando", "Takeaway.com", -28, 2.5],
    ["Starbucks", "Starbucks Coffee", -6.8, 3],
    ["L'Osteria", "Restaurant L'Osteria", -38, 1.5],
    ["McFit", "RSG Group Fitness", -24.9, 1],
    ["Apotheke", "Rathaus Apotheke", -19, 0.8],
    ["Stadtwerke", "Stadtwerke Abschlag Strom", -85, 1],
    ["Vermieter Wohnbau GmbH", "Miete Wohnung", -1180, 1],
    ["Trade Republic", "Trade Republic Bank Sparplan", -400, 1],
    ["Philoro", "Philoro Edelmetalle GmbH", -520, 0.3],
    ["ATM", "Geldautomat Abhebung", -100, 0.8],
    ["Booking.com", "Booking.com Hotel", -240, 0.25],
    ["Eventim", "CTS Eventim Tickets", -75, 0.3],
    ["Acme Software GmbH", "Gehalt", 4650, 1],
    ["Kunde Schneider", "Rechnung 2026-0", 850, 0.5],
  ];

  const insert = d.prepare(
    `INSERT OR REPLACE INTO transactions (id, account_id, booking_date, amount, currency, merchant, description, category, pending)
     VALUES (?, 'demo-main', ?, ?, 'EUR', ?, ?, ?, 0)`
  );

  // deterministischer Pseudo-Zufall
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const txAll = d.transaction(() => {
    for (let month = 0; month < 8; month++) {
      for (const [merchant, desc, base, freq] of merchants) {
        const count = Math.floor(freq) + (rand() < freq % 1 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const day = Math.max(1, Math.min(28, Math.floor(rand() * 28) + 1));
          const date = new Date(now.getFullYear(), now.getMonth() - month, day);
          if (date > now) continue;
          const jitter = 1 + (rand() - 0.5) * 0.35;
          const amount = Math.round(base * (Math.abs(base) > 500 ? 1 : jitter) * 100) / 100;
          const iso = date.toISOString().slice(0, 10);
          const id = `demo-${merchant}-${month}-${i}`;
          const description = desc.endsWith("-0") ? `${desc}${month}${i}` : desc;
          insert.run(id, iso, amount, merchant, description, categorize(merchant, description, amount));
        }
      }
    }
  });
  txAll();

  // Edelmetalle, Investments und Vorsorge nur anlegen, wenn dort noch nichts
  // steht — sonst würde der Demo-Modus echte Bestände verwässern.
  const lotCount = (d.prepare("SELECT COUNT(*) AS c FROM metal_lots").get() as { c: number }).c;
  if (lotCount === 0) {
    const lots = d.prepare(
      "INSERT INTO metal_lots (metal, grams, purchase_price_eur, purchase_date, vendor, note, demo) VALUES (?, ?, ?, ?, ?, ?, 1)"
    );
    lots.run("XAU", 31.1, 2350, "2024-03-12", "Philoro", "1 oz Krügerrand");
    lots.run("XAU", 20, 1610, "2024-09-02", "Degussa", "20g Barren");
    lots.run("XAU", 10, 905, "2025-05-20", "proaurum", "10g Barren");
    lots.run("XAG", 500, 480, "2024-06-15", "Philoro", "500g Silberbarren");
    lots.run("XAG", 311, 340, "2025-02-10", "Degussa", "10 oz Maple Leaf");
    lots.run("XPT", 31.1, 980, "2025-08-01", "proaurum", "1 oz Platinbarren");
  }

  const invCount = (d.prepare("SELECT COUNT(*) AS c FROM investments").get() as { c: number }).c;
  if (invCount === 0) {
    const inv = d.prepare(
      "INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at, demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
    );
    const ts = now.toISOString();
    inv.run("iShares Core MSCI World", "IWDA.AS", 148, 82.4, 101.2, "etf", ts);
    inv.run("Vanguard FTSE All-World", "VWCE.DE", 52, 104.1, 128.6, "etf", ts);
    inv.run("Apple Inc.", "AAPL", 12, 168.0, 214.5, "stock", ts);
    inv.run("Bitcoin", "BTC-EUR", 0.18, 38200, 61800, "crypto", ts);
  }

  const penCount = (d.prepare("SELECT COUNT(*) AS c FROM pension_statements").get() as { c: number }).c;
  if (penCount === 0) {
    const pen = d.prepare(
      "INSERT INTO pension_statements (statement_date, balance_eur, contribution_eur, note, demo) VALUES (?, ?, ?, ?, 1)"
    );
    pen.run("2024-01-15", 9840.2, 1800, "Jahresmitteilung 2023");
    pen.run("2025-01-15", 12130.5, 1800, "Jahresmitteilung 2024");
    pen.run("2026-01-15", 14250.8, 1800, "Jahresmitteilung 2025");
    setSetting("pension_provider", "Muster Direktversicherung (Demo)");
    setSetting("pension_monthly", "150");
  }

  setSetting("demo_mode", "1");
}

/**
 * Vor Einführung der demo-Spalte angelegte Demo-Daten tragen keine Markierung
 * und blieben beim Entfernen liegen. Sie werden hier an ihren exakten
 * Seed-Werten erkannt und nachträglich markiert — nur bei aktivem Demo-Modus,
 * damit zufällig identische echte Positionen nicht getroffen werden.
 */
function backfillDemoFlags() {
  if (getSetting("demo_mode") !== "1") return;
  const d = db();

  const lots: Array<[string, number, number, string]> = [
    ["XAU", 31.1, 2350, "2024-03-12"],
    ["XAU", 20, 1610, "2024-09-02"],
    ["XAU", 10, 905, "2025-05-20"],
    ["XAG", 500, 480, "2024-06-15"],
    ["XAG", 311, 340, "2025-02-10"],
    ["XPT", 31.1, 980, "2025-08-01"],
  ];
  const markLot = d.prepare(
    "UPDATE metal_lots SET demo = 1 WHERE demo = 0 AND metal = ? AND grams = ? AND purchase_price_eur = ? AND purchase_date = ?"
  );
  for (const l of lots) markLot.run(...l);

  // Symbole allein reichen nicht — die könnte man echt besitzen. Erst Stückzahl
  // und Einstandskurs zusammen identifizieren eine Demo-Position eindeutig.
  const invs: Array<[string, number, number]> = [
    ["IWDA.AS", 148, 82.4],
    ["VWCE.DE", 52, 104.1],
    ["AAPL", 12, 168.0],
    ["BTC-EUR", 0.18, 38200],
  ];
  const markInv = d.prepare(
    "UPDATE investments SET demo = 1 WHERE demo = 0 AND symbol = ? AND units = ? AND buy_price_eur = ?"
  );
  for (const i of invs) markInv.run(...i);
}

export function clearDemoData() {
  const d = db();
  backfillDemoFlags();
  const tx = d.transaction(() => {
    d.prepare("DELETE FROM transactions WHERE account_id = 'demo-main'").run();
    d.prepare("DELETE FROM accounts WHERE id = 'demo-main'").run();
    d.prepare("DELETE FROM metal_lots WHERE demo = 1").run();
    d.prepare("DELETE FROM investments WHERE demo = 1").run();
    d.prepare("DELETE FROM pension_statements WHERE demo = 1").run();
    if (getSetting("pension_provider") === "Muster Direktversicherung (Demo)") {
      deleteSetting("pension_provider");
      deleteSetting("pension_monthly");
    }
    setSetting("demo_mode", "0");
  });
  tx();
}
