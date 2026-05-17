import db from './index';

interface User {
  id: number;
  discordId: string;
  username: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

class UserRepository {
  getOrCreateUser(discordId: string, username: string): User {
    const getUser = db.prepare('SELECT * FROM users WHERE discordId = ?');
    const user = getUser.get(discordId);
    if (user) return user;

    const insertUser = db.prepare(`
      INSERT INTO users (discordId, username, credits) 
      VALUES (?, ?, 100)
    `);
    const info = insertUser.run(discordId, username);
    return this.getUserById(info.lastInsertRowid);
  }

  getUser(discordId: string): User | null {
    const getUser = db.prepare('SELECT * FROM users WHERE discordId = ?');
    return getUser.get(discordId) || null;
  }

  updateCredits(discordId: string, delta: number, description: string): void {
    const user = this.getUser(discordId);
    if (!user) throw new Error('User not found');

    const updateCredits = db.prepare('UPDATE users SET credits = credits + ? WHERE discordId = ?');
    updateCredits.run(delta, discordId);

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (userId, type, amount, description) 
      VALUES (?, ?, ?, ?)
    `);
    insertTransaction.run(user.id, delta >= 0 ? 'add' : 'use', Math.abs(delta), description);
  }

  getCredits(discordId: string): number {
    const user = this.getUser(discordId);
    if (!user) throw new Error('User not found');
    return user.credits;
  }
}

export default new UserRepository();
