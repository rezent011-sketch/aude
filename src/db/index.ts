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
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    task TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    next_run TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    requester_discord_id TEXT NOT NULL,
    requester_username TEXT NOT NULL,
    requester_plan TEXT NOT NULL CHECK(requester_plan IN ('free', 'starter', 'pro', 'team')),
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    task_description TEXT NOT NULL,
    model TEXT NOT NULL CHECK(model IN ('auto', 'claude', 'gpt4o')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'rejected', 'timed_out', 'completed', 'failed')),
    approver_discord_id TEXT,
    approver_username TEXT,
    decided_at TEXT,
    expires_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    result_summary TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
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
