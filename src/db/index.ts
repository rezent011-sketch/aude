import fs from 'fs';
import path from 'path';
import { Database } from './sqliteCompat';

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
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    alert_type TEXT CHECK(alert_type IN ('keyword','schedule','threshold','reminder')) NOT NULL,
    name TEXT NOT NULL,
    condition TEXT NOT NULL,
    cron_expr TEXT,
    message TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_triggered TEXT,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_alerts_guild
  ON alerts(guild_id);
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
  CREATE TABLE IF NOT EXISTS model_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL CHECK(model IN ('auto', 'claude', 'gpt4o')),
    updated_by_discord_id TEXT NOT NULL,
    updated_by_username TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    guild_name TEXT NOT NULL DEFAULT '',
    prefix TEXT NOT NULL DEFAULT '!',
    default_model TEXT NOT NULL DEFAULT 'auto',
    admin_role_id TEXT,
    welcome_channel_id TEXT,
    max_credits_per_user INTEGER NOT NULL DEFAULT 100,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'command',
    response TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by_discord_id TEXT NOT NULL DEFAULT '',
    created_by_username TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
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

db.exec(`
  CREATE TRIGGER IF NOT EXISTS model_preferences_set_updated_at
  AFTER UPDATE ON model_preferences
  FOR EACH ROW
  BEGIN
    UPDATE model_preferences
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

// Week13: AIメモリシステム
db.exec(`
  CREATE TABLE IF NOT EXISTS user_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK(memory_type IN ('preference', 'fact', 'skill', 'context')),
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'auto',
    importance INTEGER NOT NULL DEFAULT 1 CHECK(importance BETWEEN 1 AND 5),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_memories_discord_id
  ON user_memories(discord_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS team_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    added_by TEXT NOT NULL,
    memory_type TEXT CHECK(memory_type IN ('fact','rule','context','goal')) NOT NULL DEFAULT 'fact',
    content TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_team_memories_guild
  ON team_memories(guild_id);
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS user_memories_set_updated_at
  AFTER UPDATE ON user_memories
  FOR EACH ROW
  BEGIN
    UPDATE user_memories
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS team_memories_set_updated_at
  AFTER UPDATE ON team_memories
  FOR EACH ROW
  BEGIN
    UPDATE team_memories
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

export default db;
