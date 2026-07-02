export const GUEST_DAILY_LIMIT  = 5;
export const TRIAL_DAYS         = 3;
export const TRIAL_MS           = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// MODUS went fully paid (card-required 3-day trial, no free tier) at this moment.
// Users whose Firebase account was created before this are grandfathered into
// permanent free access; everyone after must start a paid trial. See
// enforceSubscriptionGate in lib/chat/limits.ts.
export const PAYWALL_LAUNCH_MS  = Date.parse('2026-07-02T00:00:00Z');

export const MODUS_TOKEN_LIMIT  = 500_000;
export const PILOT_TOKEN_LIMIT  = 1_500_000;
export const MODUS_WEEKLY_LIMIT = MODUS_TOKEN_LIMIT * 7;
export const PILOT_WEEKLY_LIMIT = PILOT_TOKEN_LIMIT * 7;
