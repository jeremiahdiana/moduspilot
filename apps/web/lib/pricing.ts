/**
 * One source of truth for what MODUS costs.
 *
 * The marketing pages render from this and /api/stripe/checkout resolves its
 * Stripe price from it, so a number on the page can never drift from the number
 * on the card. Amounts here are DISPLAY dollars; Stripe holds the real amounts.
 *
 * Annual = 2 months free, chosen so MODUS lands at $20/mo effective — exactly
 * what ChatGPT Plus costs alone. That equivalence is the whole pitch; if you
 * change the discount, the "for what ChatGPT costs" copy has to change too.
 */

export type Cadence = 'monthly' | 'annual';

export const CADENCES: Cadence[] = ['monthly', 'annual'];

export function isCadence(v: unknown): v is Cadence {
  return v === 'monthly' || v === 'annual';
}

type PlanPricing = {
  /** Headline number, always expressed per-month so the two cadences compare. */
  monthlyPrice: number;
  annualPerMonth: number;
  /** What actually gets charged once a year. */
  annualTotal: number;
};

export const PLAN_PRICING: Record<'modus' | 'pilot', PlanPricing> = {
  modus: { monthlyPrice: 24, annualPerMonth: 20, annualTotal: 240 },
  pilot: { monthlyPrice: 59, annualPerMonth: 49, annualTotal: 588 },
};

/** Months of the year you don't pay for, for the toggle's badge. */
export const MONTHS_FREE = 2;

/** Env var holding the Stripe price for a given plan + cadence. */
export const PRICE_ENV: Record<string, Record<Cadence, string | undefined>> = {
  modus: { monthly: 'STRIPE_PRICE_MODUS', annual: 'STRIPE_PRICE_MODUS_ANNUAL' },
  pilot: { monthly: 'STRIPE_PRICE_PILOT', annual: 'STRIPE_PRICE_PILOT_ANNUAL' },
  // Group is monthly-only today — there is no annual Group price in Stripe, so
  // an annual request for it must fall back rather than 400.
  group: { monthly: 'STRIPE_PRICE_GROUP', annual: undefined },
};

/** Where the chosen cadence is parked across the /login -> onboarding hop. */
export const CADENCE_STORAGE_KEY = 'modus.cadence';

/**
 * Resolve plan + cadence to a Stripe price. Annual falls back to monthly when no
 * annual price exists (Group), and when the env var is missing — better to bill
 * the cadence we can actually honour than to 400 someone out of checkout.
 *
 * Lives here, not in a route, because BOTH /api/stripe/checkout and
 * /api/stripe/change-plan need it. change-plan used to hold its own monthly-only
 * map, so an annual subscriber who changed plan was silently moved onto monthly
 * billing — the classic "the fix landed in one of the two call sites" bug.
 *
 * Always returns the cadence actually resolved, never the one requested.
 */
export function resolvePlanPrice(plan: string, cadence: Cadence): { priceId?: string; cadence: Cadence } {
  const envs = PRICE_ENV[plan];
  if (!envs) return { cadence };

  if (cadence === 'annual' && envs.annual) {
    const annual = process.env[envs.annual];
    if (annual) return { priceId: annual, cadence: 'annual' };
  }
  return { priceId: envs.monthly ? process.env[envs.monthly] : undefined, cadence: 'monthly' };
}
