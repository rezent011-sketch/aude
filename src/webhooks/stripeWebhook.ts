import Stripe from 'stripe';
import {
  markSubscriptionDeleted,
  stripe,
  syncSubscriptionFromCheckoutSession,
  syncSubscriptionFromStripeEvent,
} from '../stripe/stripeManager';

interface StripeWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: Buffer | string;
}

interface StripeWebhookResponse {
  status(code: number): StripeWebhookResponse;
  send(body: string): void;
  json(body: unknown): void;
}

export const stripeWebhook = async (
  req: StripeWebhookRequest,
  res: StripeWebhookResponse
): Promise<void> => {
  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    res.status(400).send('Webhook Error: missing signature or webhook secret');
    return;
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await syncSubscriptionFromCheckoutSession(
          event.data.object as Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
        );
        break;
      }
      case 'customer.subscription.updated': {
        await syncSubscriptionFromStripeEvent(
          event.data.object as Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>
        );
        break;
      }
      case 'customer.subscription.deleted': {
        markSubscriptionDeleted(
          event.data.object as Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>
        );
        break;
      }
      default: {
        console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).send(`Webhook handler error: ${message}`);
    return;
  }

  res.json({ received: true });
};
