import { db, setSetting } from "./db";
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

  // Edelmetall-Demo-Käufe (nur wenn noch keine vorhanden)
  const lotCount = (d.prepare("SELECT COUNT(*) AS c FROM metal_lots").get() as { c: number }).c;
  if (lotCount === 0) {
    const lots = d.prepare(
      "INSERT INTO metal_lots (metal, grams, purchase_price_eur, purchase_date, vendor, note) VALUES (?, ?, ?, ?, ?, ?)"
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
      "INSERT INTO investments (name, symbol, units, buy_price_eur, current_price_eur, kind, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const ts = now.toISOString();
    inv.run("iShares Core MSCI World", "IWDA.AS", 148, 82.4, 101.2, "etf", ts);
    inv.run("Vanguard FTSE All-World", "VWCE.DE", 52, 104.1, 128.6, "etf", ts);
    inv.run("Apple Inc.", "AAPL", 12, 168.0, 214.5, "stock", ts);
    inv.run("Bitcoin", "BTC-EUR", 0.18, 38200, 61800, "crypto", ts);
  }

  setSetting("demo_mode", "1");
}

export function clearDemoData() {
  const d = db();
  d.prepare("DELETE FROM transactions WHERE account_id = 'demo-main'").run();
  d.prepare("DELETE FROM accounts WHERE id = 'demo-main'").run();
  setSetting("demo_mode", "0");
}
