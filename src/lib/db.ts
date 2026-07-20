import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DATA_FILE = path.join(DATA_DIR, "achilles.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DATA_FILE);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

/** Nur für den Restore: Verbindung lösen, damit die Datei ersetzt werden kann. */
export function closeDb() {
  _db?.close();
  _db = null;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'bank',
      name TEXT,
      iban TEXT,
      currency TEXT DEFAULT 'EUR',
      balance REAL DEFAULT 0,
      last_synced TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      merchant TEXT,
      description TEXT,
      category TEXT,
      category_locked INTEGER DEFAULT 0,
      pending INTEGER DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(booking_date);
    CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category);

    CREATE TABLE IF NOT EXISTS metal_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metal TEXT NOT NULL,              -- XAU | XAG | XPT | XPD
      grams REAL NOT NULL,
      purchase_price_eur REAL NOT NULL, -- total paid for this lot
      purchase_date TEXT NOT NULL,
      vendor TEXT,
      note TEXT,
      demo INTEGER DEFAULT 0            -- 1 = aus dem Demo-Seed, wird beim Entfernen gelöscht
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT,
      units REAL NOT NULL,
      buy_price_eur REAL NOT NULL,      -- per unit
      current_price_eur REAL,           -- per unit
      kind TEXT DEFAULT 'stock',        -- stock | etf | crypto | other
      updated_at TEXT,
      source TEXT,                      -- 'csv' = aus einem Depot-Export; von Hand gepflegte bleiben NULL
      demo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS price_cache (
      symbol TEXT PRIMARY KEY,
      eur_per_gram REAL NOT NULL,
      usd_per_oz REAL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      label TEXT,
      added_at TEXT NOT NULL,
      -- Kurs beim Hinzufügen, um den Zuwachs seither zu zeigen. Ohne diesen
      -- Wert wäre er später nicht mehr rekonstruierbar.
      price_at_add REAL,
      price_eur_at_add REAL,
      currency_at_add TEXT,
      pinned INTEGER DEFAULT 0,       -- angepinnt: steht vor allen anderen
      sort_order INTEGER DEFAULT 0    -- selbst gelegte Reihenfolge (Drag & Drop)
    );

    CREATE TABLE IF NOT EXISTS quote_cache (
      symbol TEXT PRIMARY KEY,
      price REAL NOT NULL,
      prev_close REAL,
      currency TEXT,
      name TEXT,
      price_eur REAL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pension_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_date TEXT NOT NULL,
      balance_eur REAL NOT NULL,
      contribution_eur REAL,
      note TEXT,
      demo INTEGER DEFAULT 0
    );

    -- Fondsaufteilung der Altersvorsorge: welche ETFs mit welcher Gewichtung
    CREATE TABLE IF NOT EXISTS pension_allocation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,             -- Yahoo-Format, für Live-Kurse
      name TEXT,
      weight_pct REAL NOT NULL,
      demo INTEGER DEFAULT 0
    );

    -- Saved business valuations: your own company, or a target you are looking
    -- at. Inputs are stored as JSON so a new question doesn't need a migration.
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'own',   -- own | target
      inputs TEXT NOT NULL,               -- JSON, see BusinessInput
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      demo INTEGER DEFAULT 0
    );

    -- Real estate. The value is entered by hand: a genuine automated valuation
    -- needs a paid AVM service, and official Bodenrichtwerte only price the
    -- land, not the building — a number from those would mislead. Whoever
    -- enters the value also records where it came from.
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      address TEXT,
      value_eur REAL NOT NULL DEFAULT 0,
      value_source TEXT,                -- appraisal, portal listing, own estimate …
      valued_on TEXT,                   -- the value is only as good as its date
      purchase_price_eur REAL,
      purchase_date TEXT,
      size_sqm REAL,
      -- Your share of the property in percent. Co-ownership is common, and
      -- counting the full value would overstate net worth.
      share_pct REAL NOT NULL DEFAULT 100,
      note TEXT,
      created_at TEXT NOT NULL,
      demo INTEGER DEFAULT 0
    );

    -- Photos live in the database, not on disk, so the encrypted backup really
    -- contains everything. They are downscaled in the browser before upload to
    -- keep that honest promise affordable.
    CREATE TABLE IF NOT EXISTS property_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      image BLOB NOT NULL,
      mime TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );
    CREATE INDEX IF NOT EXISTS idx_property_photos ON property_photos(property_id);

    -- Kredite: verliehen (Forderung) oder aufgenommen (Verbindlichkeit)
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL,          -- lent | borrowed
      counterparty TEXT NOT NULL,       -- an wen verliehen / bei wem aufgenommen
      kind TEXT NOT NULL DEFAULT 'private',  -- private | bank
      principal_eur REAL NOT NULL,      -- ursprüngliche Summe
      interest_pct REAL DEFAULT 0,      -- Jahreszins in %, 0 = zinslos
      start_date TEXT NOT NULL,
      due_date TEXT,                    -- optional
      note TEXT,
      closed INTEGER DEFAULT 0,         -- von Hand abgeschlossen
      demo INTEGER DEFAULT 0
    );

    -- Einzelne Zahlungen auf einen Kredit, von Hand erfasst
    CREATE TABLE IF NOT EXISTS loan_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      paid_on TEXT NOT NULL,
      amount_eur REAL NOT NULL,
      note TEXT,
      FOREIGN KEY (loan_id) REFERENCES loans(id)
    );
    CREATE INDEX IF NOT EXISTS idx_loan_payments ON loan_payments(loan_id);

    -- Gespeicherte FIRE-Szenarien; params als JSON, damit neue Parameter
    -- keine Migration brauchen
    CREATE TABLE IF NOT EXISTS fire_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      demo INTEGER DEFAULT 0
    );
  `);

  // Bestehende Datenbanken nachziehen — CREATE TABLE IF NOT EXISTS ändert
  // vorhandene Tabellen nicht, die demo-Spalte muss nachgerüstet werden.
  for (const table of ["metal_lots", "investments", "pension_statements"]) {
    addColumnIfMissing(d, table, "demo", "INTEGER DEFAULT 0");
  }
  for (const [col, def] of [["price_at_add", "REAL"], ["price_eur_at_add", "REAL"], ["currency_at_add", "TEXT"], ["pinned", "INTEGER DEFAULT 0"], ["sort_order", "INTEGER DEFAULT 0"]]) {
    addColumnIfMissing(d, "watchlist", col, def);
  }
  // Unterscheidet importierte von handgepflegten Positionen — nur so kann ein
  // erneuter Import "ersetzen" anbieten, ohne eigene Einträge mitzulöschen.
  addColumnIfMissing(d, "investments", "source", "TEXT");
  addColumnIfMissing(d, "properties", "share_pct", "REAL NOT NULL DEFAULT 100");
  // Bestandslisten haben noch keine Reihenfolge. Ohne Startwert stünden sie
  // alle auf 0 und neue Einträge sortierten sich vor die bestehenden — die id
  // ist aufsteigend und bildet damit die Aufnahmereihenfolge ab.
  d.exec("UPDATE watchlist SET sort_order = id WHERE sort_order = 0");
}

function addColumnIfMissing(d: Database.Database, table: string, column: string, definition: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function deleteSetting(key: string) {
  db().prepare("DELETE FROM settings WHERE key = ?").run(key);
}
