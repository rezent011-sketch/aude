export const PLAN_DEFINITIONS = {
  free: {
    amount: 0,
    credits: 0,
    label: 'Free',
    labelJa: 'Free',
  },
  starter: {
    amount: 980,
    credits: 1000,
    label: 'Starter',
    labelJa: 'Starter',
  },
  pro: {
    amount: 2980,
    credits: 3000,
    label: 'Pro',
    labelJa: 'Pro',
  },
  team: {
    amount: 9800,
    credits: 10000,
    label: 'Team',
    labelJa: 'Team',
  },
} as const;

export type SubscriptionPlan = keyof typeof PLAN_DEFINITIONS;

export const PLAN_ORDER: SubscriptionPlan[] = ['free', 'starter', 'pro', 'team'];

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value in PLAN_DEFINITIONS;
}

export function getCreditsForPlan(plan: SubscriptionPlan): number {
  return PLAN_DEFINITIONS[plan].credits;
}

export function getPlanAmount(plan: SubscriptionPlan): number {
  return PLAN_DEFINITIONS[plan].amount;
}

export function getPlanLabel(plan: SubscriptionPlan): string {
  return PLAN_DEFINITIONS[plan].label;
}

export function getPlanLabelJa(plan: SubscriptionPlan): string {
  return PLAN_DEFINITIONS[plan].labelJa;
}

export function planFromAmount(amount: number | null | undefined): SubscriptionPlan | null {
  if (amount == null) {
    return null;
  }

  const entry = Object.entries(PLAN_DEFINITIONS).find(([, definition]) => definition.amount === amount);
  return (entry?.[0] as SubscriptionPlan | undefined) ?? null;
}
