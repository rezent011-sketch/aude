import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Stripe secret key is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

const prices = {
    starter: 980,
    pro: 2980,
    team: 9800,
} as const;

export async function createCheckoutSession(plan: keyof typeof prices) {
  if (!(plan in prices)) {
    throw new Error(`Unknown subscription plan: ${plan}`);
  }

  const successUrl = process.env.APP_URL + '/success';
  const cancelUrl = process.env.APP_URL + '/cancel';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: plan,
          },
          unit_amount: prices[plan],
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session.url;
}
