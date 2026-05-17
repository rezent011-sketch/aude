import db from './index';

export interface User {
  id: number;
  discordId: string;
  username: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'add' | 'use' | 'refund';

export interface CreditTransaction {
  id: number;
  userId: number;
  type: TransactionType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface CreditUsageSummary {
  totalUsed: number;
  totalAdded: number;
  totalRefunded: number;
  transactionCount: number;
  firstTransactionAt: string | null;
  lastTransactionAt: string | null;
}

class UserRepository {
  private getUserStatement = db.prepare('SELECT * FROM users WHERE discordId = ?');
  private getUserByIdStatement = db.prepare('SELECT * FROM users WHERE id = ?');
  private insertUserStatement = db.prepare(`
    INSERT INTO users (discordId, username, credits)
    VALUES (?, ?, 100)
  `);
  private updateCreditsStatement = db.prepare(`
    UPDATE users
    SET credits = credits + ?
    WHERE discordId = ?
  `);
  private insertTransactionStatement = db.prepare(`
    INSERT INTO transactions (userId, type, amount, description)
    VALUES (?, ?, ?, ?)
  `);
  private getRecentTransactionsStatement = db.prepare(`
    SELECT t.*
    FROM transactions t
    INNER JOIN users u ON u.id = t.userId
    WHERE u.discordId = ?
      AND (? IS NULL OR t.type = ?)
    ORDER BY t.id DESC
    LIMIT ?
  `);
  private getCreditUsageSummaryStatement = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'use' THEN t.amount ELSE 0 END), 0) AS totalUsed,
      COALESCE(SUM(CASE WHEN t.type = 'add' THEN t.amount ELSE 0 END), 0) AS totalAdded,
      COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount ELSE 0 END), 0) AS totalRefunded,
      COUNT(*) AS transactionCount,
      MIN(t.createdAt) AS firstTransactionAt,
      MAX(t.createdAt) AS lastTransactionAt
    FROM transactions t
    INNER JOIN users u ON u.id = t.userId
    WHERE u.discordId = ?
  `);

  getOrCreateUser(discordId: string, username: string): User {
    const existingUser = this.getUser(discordId);
    if (existingUser) {
      if (existingUser.username !== username) {
        db.prepare('UPDATE users SET username = ? WHERE discordId = ?').run(username, discordId);
        return this.getUser(discordId)!;
      }
      return existingUser;
    }

    const info = this.insertUserStatement.run(discordId, username);
    return this.getUserById(Number(info.lastInsertRowid));
  }

  getUser(discordId: string): User | null {
    return (this.getUserStatement.get(discordId) as User | undefined) ?? null;
  }

  getUserById(id: number): User {
    const user = this.getUserByIdStatement.get(id) as User | undefined;
    if (!user) {
      throw new Error(`User not found for id=${id}`);
    }
    return user;
  }

  updateCredits(
    discordId: string,
    delta: number,
    description: string,
    type: TransactionType = delta < 0 ? 'use' : 'add'
  ): void {
    const user = this.getUser(discordId);
    if (!user) {
      throw new Error(`User not found for discordId=${discordId}`);
    }

    const applyChange = db.transaction(() => {
      this.updateCreditsStatement.run(delta, discordId);
      this.insertTransactionStatement.run(user.id, type, Math.abs(delta), description);
    });

    applyChange();
  }

  getCredits(discordId: string): number {
    const user = this.getUser(discordId);
    if (!user) {
      throw new Error(`User not found for discordId=${discordId}`);
    }
    return user.credits;
  }

  getRecentTransactions(
    discordId: string,
    limit = 5,
    type: TransactionType | null = null
  ): CreditTransaction[] {
    return this.getRecentTransactionsStatement.all(discordId, type, type, limit) as CreditTransaction[];
  }

  getCreditUsageSummary(discordId: string): CreditUsageSummary {
    const summary = this.getCreditUsageSummaryStatement.get(discordId) as
      | CreditUsageSummary
      | undefined;

    return {
      totalUsed: summary?.totalUsed ?? 0,
      totalAdded: summary?.totalAdded ?? 0,
      totalRefunded: summary?.totalRefunded ?? 0,
      transactionCount: summary?.transactionCount ?? 0,
      firstTransactionAt: summary?.firstTransactionAt ?? null,
      lastTransactionAt: summary?.lastTransactionAt ?? null,
    };
  }
}

export default new UserRepository();
