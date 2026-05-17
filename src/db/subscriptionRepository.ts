import db from './index';
import UserRepository from './userRepository';
import { SubscriptionPlan } from '../stripe/plans';

export interface SubscriptionRecord {
  id: number;
  userId: number;
  discordId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSubscriptionInput {
  discordId: string;
  username?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

class SubscriptionRepository {
  private getByDiscordIdStatement = db.prepare(`
    SELECT s.*, u.discordId
    FROM subscriptions s
    INNER JOIN users u ON u.id = s.userId
    WHERE u.discordId = ?
  `);
  private getByStripeCustomerIdStatement = db.prepare(`
    SELECT s.*, u.discordId
    FROM subscriptions s
    INNER JOIN users u ON u.id = s.userId
    WHERE s.stripeCustomerId = ?
  `);
  private getByStripeSubscriptionIdStatement = db.prepare(`
    SELECT s.*, u.discordId
    FROM subscriptions s
    INNER JOIN users u ON u.id = s.userId
    WHERE s.stripeSubscriptionId = ?
  `);
  private insertStatement = db.prepare(`
    INSERT INTO subscriptions (
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      plan,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  private updateStatement = db.prepare(`
    UPDATE subscriptions
    SET stripeCustomerId = ?,
        stripeSubscriptionId = ?,
        plan = ?,
        status = ?,
        currentPeriodStart = ?,
        currentPeriodEnd = ?,
        cancelAtPeriodEnd = ?
    WHERE id = ?
  `);

  getByDiscordId(discordId: string): SubscriptionRecord | null {
    return (this.getByDiscordIdStatement.get(discordId) as SubscriptionRecord | undefined) ?? null;
  }

  getByStripeCustomerId(customerId: string): SubscriptionRecord | null {
    return (
      this.getByStripeCustomerIdStatement.get(customerId) as SubscriptionRecord | undefined
    ) ?? null;
  }

  getByStripeSubscriptionId(subscriptionId: string): SubscriptionRecord | null {
    return (
      this.getByStripeSubscriptionIdStatement.get(subscriptionId) as SubscriptionRecord | undefined
    ) ?? null;
  }

  upsert(input: UpsertSubscriptionInput): { previousPlan: SubscriptionPlan | null; record: SubscriptionRecord } {
    const username = input.username ?? `discord-${input.discordId}`;
    const user = UserRepository.getOrCreateUser(input.discordId, username);
    const existing = this.getByDiscordId(input.discordId);

    const stripeCustomerId = input.stripeCustomerId ?? existing?.stripeCustomerId ?? null;
    const stripeSubscriptionId = input.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null;
    const currentPeriodStart = input.currentPeriodStart ?? existing?.currentPeriodStart ?? null;
    const currentPeriodEnd = input.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null;
    const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? Boolean(existing?.cancelAtPeriodEnd);

    if (existing) {
      this.updateStatement.run(
        stripeCustomerId,
        stripeSubscriptionId,
        input.plan,
        input.status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd ? 1 : 0,
        existing.id
      );
    } else {
      this.insertStatement.run(
        user.id,
        stripeCustomerId,
        stripeSubscriptionId,
        input.plan,
        input.status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd ? 1 : 0
      );
    }

    const record = this.getByDiscordId(input.discordId);
    if (!record) {
      throw new Error(`Failed to upsert subscription for discordId=${input.discordId}`);
    }

    return { previousPlan: existing?.plan ?? null, record };
  }
}

export default new SubscriptionRepository();
