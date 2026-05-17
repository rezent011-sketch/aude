import { createCheckoutSession } from '../stripe/stripeManager';

export async function subscribe(plan: 'starter' | 'pro' | 'team'): Promise<string> {
  try {
    const url = await createCheckoutSession(plan);
    return `Success! Click here to subscribe: ${url}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error creating subscription: ${message}`;
  }
}
