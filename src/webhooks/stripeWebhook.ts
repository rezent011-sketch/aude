import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe('your-stripe-secret-key', {
  apiVersion: '2020-08-27',
});

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      'your-webhook-signing-secret'
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Logic to add credits to the user's account
    console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
  }

  res.json({received: true});
};
