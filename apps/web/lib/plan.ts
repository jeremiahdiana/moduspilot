// Single source of truth for plan tiers + access gates. Centralized so adding a
// new plan (the way Group was added) can't silently miss a paid-gate scattered
// across the codebase.

export type Plan = 'free' | 'modus' | 'pilot' | 'group';

/** Any paid plan — exempt from free limits, eligible for paid features. */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'modus' || plan === 'pilot' || plan === 'group';
}

/**
 * Whether a user may use MODUS at all. Since MODUS is fully paid, access requires
 * either a paid/trialing subscription (plan set by Stripe webhook) OR being
 * grandfathered (accounts that existed before the paywall launch — see
 * PAYWALL_LAUNCH_MS). New signups without a subscription have no access.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasActiveAccess(userData: Record<string, any> | null | undefined): boolean {
  if (!userData) return false;
  return isPaidPlan(userData.plan) || userData.grandfathered === true;
}

/**
 * PILOT-level access (premium models, higher ceilings). Group is the most
 * expensive plan, so its members get the same access as PILOT.
 */
export function isPilotLevelPlan(plan: string | null | undefined): boolean {
  return plan === 'pilot' || plan === 'group';
}
