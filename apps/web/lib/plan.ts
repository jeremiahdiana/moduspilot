// Single source of truth for plan tiers + access gates. Centralized so adding a
// new plan (the way Group was added) can't silently miss a paid-gate scattered
// across the codebase.
//
// 🚨 CLIENT-SAFE ON PURPOSE. UsageSettings renders the usage meter in the browser
// and MUST compute ceilings from the same function the server gates on — see
// planCeilings below.
import {
  MODUS_TOKEN_LIMIT,
  PILOT_TOKEN_LIMIT,
  MODUS_WEEKLY_LIMIT,
  PILOT_WEEKLY_LIMIT,
  LIMIT_ADDON_DAILY,
  LIMIT_ADDON_WEEKLY,
} from '@/lib/constants';

export type Plan = 'free' | 'modus' | 'pilot' | 'group';

/** Any paid plan — exempt from free limits, eligible for paid features. */
export function isPaidPlan(plan: string | null | undefined): plan is 'modus' | 'pilot' | 'group' {
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

/**
 * How many purchased limit add-ons this account holds. Absent/garbage → 0.
 *
 * Stored as a Stripe subscription QUANTITY mirrored onto the users doc by the
 * webhook, so it is an integer >= 0. Coerced defensively because a hand-edited
 * Firestore doc must not be able to hand someone an infinite ceiling.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function limitAddonQty(userData: Record<string, any> | null | undefined): number {
  const raw = Number(userData?.limitAddonQty);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

/**
 * The daily + weekly ceilings this account actually gets, add-on included.
 *
 * 🪤 THE WHOLE POINT IS THAT THERE IS EXACTLY ONE OF THESE. The ceilings used to
 * be recomputed in THREE places — enforcePaidTokenLimit and usagePercent in
 * lib/chat/limits.ts, and UsageSettings on the client. Teaching two of the three
 * about the add-on is the bug that ships: the meter reads 100% while the gate
 * happily serves, or worse the gate blocks at a number the meter never showed.
 * lib/pricing.ts documents the same class of bug from change-plan.
 *
 * Everything that needs a ceiling calls this. Nothing recomputes it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function planCeilings(userData: Record<string, any> | null | undefined): { daily: number; weekly: number } {
  const pilot = isPilotLevelPlan(userData?.plan);
  const qty = limitAddonQty(userData);
  return {
    daily:  (pilot ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT)  + qty * LIMIT_ADDON_DAILY,
    weekly: (pilot ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT) + qty * LIMIT_ADDON_WEEKLY,
  };
}
