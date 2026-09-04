// Single source of truth for plan tiers + access gates. Centralized so adding a
// new plan (the way Group was added) can't silently miss a paid-gate scattered
// across the codebase.
//
// 🚨 CLIENT-SAFE ON PURPOSE. UsageSettings renders the usage meter in the browser
// and MUST compute ceilings from the same function the server gates on — see
// planCeilings below.
import {
  MODUS_WINDOW_LIMIT,
  PILOT_WINDOW_LIMIT,
  MODUS_WEEKLY_LIMIT,
  PILOT_WEEKLY_LIMIT,
  LIMIT_ADDON_WINDOW,
  LIMIT_ADDON_WEEKLY,
} from '@/lib/constants';

export type Plan = 'free' | 'modus' | 'pilot' | 'group';

/** Any paid plan — exempt from free limits, eligible for paid features. */
export function isPaidPlan(plan: string | null | undefined): plan is 'modus' | 'pilot' | 'group' {
  return plan === 'modus' || plan === 'pilot' || plan === 'group';
}

/**
 * Whether a user has FULL, unmetered access. That means ONE thing: a paid or
 * trialing subscription, `plan` written by the Stripe webhook.
 *
 * 🗑️ REMOVED 2026-08-06: a second branch used to grant this to any account created
 * before PAYWALL_LAUNCH_MS, flagged `preLaunchAccess` (originally `grandfathered`).
 * **Jeremiah never made that rule.** It was invented by an earlier session and
 * inherited by everything downstream, and its name kept being mistaken for
 * moduspilot.com/grandfathering, which is the opposite thing: founding members who
 * PAY $24/mo and carry plan:'pilot'. There is no free tier keyed on signup date.
 * Pre-paywall accounts get the ordinary free tier like everyone else.
 *
 * ⚠️ FALSE NO LONGER MEANS "NO ACCESS", and callers written before 2026-08-04
 * assume it does. Since the free tier landed, an account this returns false for
 * may still send FREE_MESSAGE_LIMIT messages — enforceSubscriptionGate owns that
 * decision, not this function. Use this for "is this person entitled to the paid
 * product?" (premium models, image generation, scheduled briefings). Do NOT use
 * it as a blanket "can they use MODUS at all?" — that question now has a third
 * answer between yes and no.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasActiveAccess(userData: Record<string, any> | null | undefined): boolean {
  if (!userData) return false;
  return isPaidPlan(userData.plan);
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
 * The per-window + weekly ceilings this account actually gets, add-on included.
 *
 * `window` is the ceiling for one rolling WINDOW_HOURS session; `weekly` is the
 * Monday-anchored UTC week. See lib/constants.ts for why the two are decoupled
 * (the window allows a burst, the week bounds the dollars).
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
export function planCeilings(userData: Record<string, any> | null | undefined): { window: number; weekly: number } {
  const pilot = isPilotLevelPlan(userData?.plan);
  const qty = limitAddonQty(userData);
  return {
    window: (pilot ? PILOT_WINDOW_LIMIT : MODUS_WINDOW_LIMIT) + qty * LIMIT_ADDON_WINDOW,
    weekly: (pilot ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT) + qty * LIMIT_ADDON_WEEKLY,
  };
}
