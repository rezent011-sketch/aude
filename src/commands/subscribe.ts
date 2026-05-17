import { createCheckoutSession } from '../stripe/stripeManager';

export async function subscribe(plan: string): Promise<string> {
  try {
    const url = await createCheckoutSession(plan);
    return `Success! Click here to subscribe: ${url}`;
  } catch (error) {
    return `Error creating subscription: ${error.message}`;
  }
}
