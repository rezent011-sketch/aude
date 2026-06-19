import Stripe from 'stripe';
import db from '../db/database';

export type CreditTransactionType = 'credit' | 'debit';

export interface CreditTransaction {
  id: number;
  user_id: string;
  amount: number;
  type: CreditTransactionType;
  description: string | null;
  created_at: string;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('クレジットが不足しています。');
    this.name = 'InsufficientCreditsError';
  }
}

const ensureCreditRowStatement = db.prepare(`
  INSERT INTO credits (user_id, balance)
  VALUES (?, 0)
  ON CONFLICT(user_id) DO NOTHING
`);

const getBalanceStatement = db.prepare(`
  SELECT balance
  FROM credits
  WHERE user_id = ?
`);

const updateBalanceStatement = db.prepare(`
  UPDATE credits
  SET balance = balance + ?
  WHERE user_id = ?
`);

const insertTransactionStatement = db.prepare(`
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (?, ?, ?, ?)
`);

const getHistoryStatement = db.prepare(`
  SELECT id, user_id, amount, type, description, created_at
  FROM transactions
  WHERE user_id = ?
  ORDER BY id DESC
`);

const getLegacyUserStatement = db.prepare(`
  SELECT credits
  FROM users
  WHERE discordId = ?
`);

const insertLegacyUserStatement = db.prepare(`
  INSERT INTO users (discordId, username, credits)
  VALUES (?, ?, 0)
  ON CONFLICT(discordId) DO NOTHING
`);

const updateLegacyCreditsStatement = db.prepare(`
  UPDATE users
  SET credits = credits + ?
  WHERE discordId = ?
`);

const findStripeCreditTransactionStatement = db.prepare(`
  SELECT id
  FROM transactions
  WHERE user_id = ?
    AND type = 'credit'
    AND description = ?
  LIMIT 1
`);

function ensureCreditRow(userId: string): void {
  ensureCreditRowStatement.run(userId);
}

function syncLegacyCredits(userId: string, delta: number, username?: string): void {
  if (username) {
    insertLegacyUserStatement.run(userId, username);
  }

  const legacyUser = getLegacyUserStatement.get(userId) as { credits: number } | undefined;
  if (!legacyUser) {
    return;
  }

  updateLegacyCreditsStatement.run(delta, userId);
}

class CreditsService {
  getBalance(userId: string, username?: string): number {
    ensureCreditRow(userId);
    syncLegacyCredits(userId, 0, username);

    const row = getBalanceStatement.get(userId) as { balance: number } | undefined;
    return row?.balance ?? 0;
  }

  addCredits(userId: string, amount: number, description: string, username?: string): number {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('amount must be a positive integer');
    }

    const applyChange = db.transaction(() => {
      ensureCreditRow(userId);
      syncLegacyCredits(userId, 0, username);
      updateBalanceStatement.run(amount, userId);
      insertTransactionStatement.run(userId, amount, 'credit', description);
      syncLegacyCredits(userId, amount);
    });

    applyChange();
    return this.getBalance(userId, username);
  }

  useCredits(userId: string, amount: number, description: string, username?: string): number {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('amount must be a positive integer');
    }

    const applyChange = db.transaction(() => {
      const currentBalance = this.getBalance(userId, username);
      if (currentBalance < amount) {
        throw new InsufficientCreditsError();
      }

      updateBalanceStatement.run(-amount, userId);
      insertTransactionStatement.run(userId, amount, 'debit', description);
      syncLegacyCredits(userId, -amount);
    });

    applyChange();
    return this.getBalance(userId, username);
  }

  getTransactionHistory(userId: string, username?: string): CreditTransaction[] {
    ensureCreditRow(userId);
    syncLegacyCredits(userId, 0, username);
    return getHistoryStatement.all(userId) as CreditTransaction[];
  }

  async createCheckoutSession(params: {
    userId: string;
    username?: string;
    amount: number;
  }): Promise<{ id: string; url: string | null }> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set.');
    }

    const stripe = new Stripe(secretKey);
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: params.userId,
      metadata: {
        userId: params.userId,
        username: params.username ?? '',
        credits: String(params.amount),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: params.amount,
            product_data: {
              name: `${params.amount} credits`,
              description: `${params.amount}クレジットを追加`,
            },
          },
        },
      ],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set.');
    }

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
    }

    const stripe = new Stripe(secretKey);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object as {
      id: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string | undefined>;
    };

    const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
    const username = session.metadata?.username || undefined;
    const credits = Number(session.metadata?.credits ?? '0');

    if (!userId || !Number.isInteger(credits) || credits <= 0) {
      throw new Error('Stripe session metadata is invalid.');
    }

    const description = `Stripe checkout: ${session.id}`;
    const duplicate = findStripeCreditTransactionStatement.get(userId, description) as
      | { id: number }
      | undefined;

    if (duplicate) {
      return;
    }

    this.addCredits(userId, credits, description, username);
  }
}

export const creditsService = new CreditsService();
