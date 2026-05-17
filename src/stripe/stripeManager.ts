import Stripe from 'stripe';
import SubscriptionRepository from '../db/subscriptionRepository';
import UserRepository from '../db/userRepository';
import {
  getCreditsForPlan,
  getPlanAmount,
  getPlanLabelJa,
  isSubscriptionPlan,
  planFromAmount,
  SubscriptionPlan,
} from './plans';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Stripe secret key is not set in environment variables.');
}

export const stripe = new Stripe(stripeSecretKey);

export interface CreateCheckoutSessionParams {
  plan: SubscriptionPlan;
  discordUserId: string;
  username?: string;
}

export interface CreateCheckoutSessionResult {
  checkoutUrl: string | null;
  message: string;
}

function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

function toIsoString(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) {
    return null;
  }

  return new Date(unixSeconds * 1000).toISOString();
}

type StripeSubscriptionLike = Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>;

function getSubscriptionPeriodStart(subscription: StripeSubscriptionLike): number | null {
  return subscription.items.data[0]?.current_period_start ?? subscription.billing_cycle_anchor ?? null;
}

function getSubscriptionPeriodEnd(subscription: StripeSubscriptionLike): number | null {
  return subscription.items.data[0]?.current_period_end ?? subscription.trial_end ?? null;
}

function resolvePlanFromSubscription(subscription: StripeSubscriptionLike): SubscriptionPlan {
  const metadataPlan = subscription.metadata.plan;
  if (metadataPlan && isSubscriptionPlan(metadataPlan)) {
    return metadataPlan;
  }

  const amount = subscription.items.data[0]?.price.unit_amount;
  const inferredPlan = planFromAmount(amount);
  if (!inferredPlan) {
    throw new Error(`Unable to resolve plan from Stripe subscription ${subscription.id}`);
  }

  return inferredPlan;
}

function shouldGrantCredits(previousPlan: SubscriptionPlan | null, nextPlan: SubscriptionPlan, status: string): boolean {
  if (!['active', 'trialing'].includes(status)) {
    return false;
  }

  if (nextPlan === 'free' || previousPlan === nextPlan) {
    return false;
  }

  return getCreditsForPlan(nextPlan) > 0;
}

async function syncSubscription(
  subscription: StripeSubscriptionLike,
  fallbackDiscordUserId?: string,
  fallbackUsername?: string
): Promise<void> {
  const existingRecord =
    SubscriptionRepository.getByStripeSubscriptionId(subscription.id) ??
    (typeof subscription.customer === 'string'
      ? SubscriptionRepository.getByStripeCustomerId(subscription.customer)
      : null);
  const discordUserId =
    subscription.metadata.discordUserId ?? fallbackDiscordUserId ?? existingRecord?.discordId;

  if (!discordUserId) {
    throw new Error(`Unable to resolve discord user id for Stripe subscription ${subscription.id}`);
  }

  const plan = resolvePlanFromSubscription(subscription);
  const { previousPlan } = SubscriptionRepository.upsert({
    discordId: discordUserId,
    username: fallbackUsername,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubscriptionId: subscription.id,
    plan,
    status: subscription.status,
    currentPeriodStart: toIsoString(getSubscriptionPeriodStart(subscription)),
    currentPeriodEnd: toIsoString(getSubscriptionPeriodEnd(subscription)),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  if (shouldGrantCredits(previousPlan, plan, subscription.status)) {
    UserRepository.updateCredits(
      discordUserId,
      getCreditsForPlan(plan),
      `${getPlanLabelJa(plan)}プランのクレジット付与`,
      'add'
    );
  }
}

export async function createCheckoutSession({
  plan,
  discordUserId,
  username,
}: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
  if (!isSubscriptionPlan(plan)) {
    throw new Error(`Unknown subscription plan: ${plan}`);
  }

  const effectiveUsername = username ?? `discord-${discordUserId}`;
  UserRepository.getOrCreateUser(discordUserId, effectiveUsername);

  if (plan === 'free') {
    SubscriptionRepository.upsert({
      discordId: discordUserId,
      username: effectiveUsername,
      plan: 'free',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    return {
      checkoutUrl: null,
      message: 'Freeプランに設定しました。',
    };
  }

  const successUrl = `${getAppUrl()}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${getAppUrl()}/cancel`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `${getPlanLabelJa(plan)} Plan`,
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: getPlanAmount(plan),
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    client_reference_id: discordUserId,
    metadata: {
      discordUserId,
      plan,
    },
    subscription_data: {
      metadata: {
        discordUserId,
        plan,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe checkout session URL was not returned');
  }

  return {
    checkoutUrl: session.url,
    message: `${getPlanLabelJa(plan)}プランの決済リンクを作成しました。`,
  };
}

export async function syncSubscriptionFromCheckoutSession(
  session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const discordUserId = session.metadata?.discordUserId ?? session.client_reference_id ?? undefined;

  if (!subscriptionId) {
    throw new Error(`Checkout session ${session.id} does not have a subscription id`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription, discordUserId ?? undefined);
}

export async function syncSubscriptionFromStripeEvent(subscription: StripeSubscriptionLike): Promise<void> {
  await syncSubscription(subscription);
}

export function markSubscriptionDeleted(subscription: StripeSubscriptionLike): void {
  const existingRecord =
    SubscriptionRepository.getByStripeSubscriptionId(subscription.id) ??
    (typeof subscription.customer === 'string'
      ? SubscriptionRepository.getByStripeCustomerId(subscription.customer)
      : null);
  const discordUserId =
    subscription.metadata.discordUserId ?? existingRecord?.discordId;

  if (!discordUserId) {
    throw new Error(`Unable to resolve discord user id for deleted subscription ${subscription.id}`);
  }

  SubscriptionRepository.upsert({
    discordId: discordUserId,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubscriptionId: subscription.id,
    plan: 'free',
    status: subscription.status,
    currentPeriodStart: toIsoString(getSubscriptionPeriodStart(subscription)),
    currentPeriodEnd: toIsoString(getSubscriptionPeriodEnd(subscription)),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}
