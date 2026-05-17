import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/aude.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discordId TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 100,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT CHECK(type IN ('add', 'use', 'refund')) NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    discordChannelId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    stripeCustomerId TEXT UNIQUE,
    stripeSubscriptionId TEXT UNIQUE,
    plan TEXT NOT NULL CHECK(plan IN ('free', 'starter', 'pro', 'team')),
    status TEXT NOT NULL,
    currentPeriodStart TEXT,
    currentPeriodEnd TEXT,
    cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS users_set_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users
    SET updatedAt = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS subscriptions_set_updated_at
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  BEGIN
    UPDATE subscriptions
    SET updatedAt = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

export default db;
