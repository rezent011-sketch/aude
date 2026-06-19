import fs from 'fs';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'aude.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new BetterSqlite3(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS credits (
    user_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
  ON transactions(user_id, created_at DESC);
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS credits_set_updated_at
  AFTER UPDATE ON credits
  FOR EACH ROW
  BEGIN
    UPDATE credits SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
  END;
`);

export function getDb(): BetterSqlite3.Database {
  return db;
}

export default db;
