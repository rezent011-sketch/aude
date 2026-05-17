import Database from 'better-sqlite3';
import path from 'path';

// Initialize the SQLite database
const dbPath = path.join(__dirname, '../../data/aude.db');
const db = new Database(dbPath);

// Create users table
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discordId TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    credits INTEGER DEFAULT 100,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;
db.exec(createUsersTable);

// Create transactions table
const createTransactionsTable = `
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    type TEXT CHECK(type IN ('add', 'use', 'refund')) NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    discordChannelId TEXT,
    role TEXT,
    content TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  );
`;
db.exec(createTransactionsTable);

export default db;
