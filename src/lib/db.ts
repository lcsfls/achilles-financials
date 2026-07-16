import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, "achilles.db"));
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
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
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT,
      units REAL NOT NULL,
      buy_price_eur REAL NOT NULL,      -- per unit
      current_price_eur REAL,           -- per unit
      kind TEXT DEFAULT 'stock',        -- stock | etf | crypto | other
      updated_at TEXT
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
      added_at TEXT NOT NULL
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
      note TEXT
    );
  `);
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
