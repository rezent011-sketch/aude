import Stripe from 'stripe';

interface StripeWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: Buffer | string;
}

interface StripeWebhookResponse {
  status(code: number): StripeWebhookResponse;
  send(body: string): void;
  json(body: unknown): void;
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(stripeSecretKey);

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

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as { amount: number };
    console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
  }

  res.json({ received: true });
};
