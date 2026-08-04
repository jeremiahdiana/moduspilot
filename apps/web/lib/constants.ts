export const GUEST_DAILY_LIMIT  = 5;
export const TRIAL_DAYS         = 3;
export const TRIAL_MS           = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// MODUS went fully paid (card-required 3-day trial, no free tier) at this moment.
// Users whose Firebase account was created before this are grandfathered into
// permanent free access; everyone after must start a paid trial. See
// enforceSubscriptionGate in lib/chat/limits.ts.
export const PAYWALL_LAUNCH_MS  = Date.parse('2026-07-02T00:00:00Z');

// ── The free taste tier ──────────────────────────────────────────────────────
//
// How many messages a signed-in account with no subscription gets before the card
// wall. Lifetime, NOT per day: a daily allowance is a permanent free product that
// a user who never pays costs you forever, and it can be farmed by waiting.
//
// 💸 WHAT THIS COSTS, because a limit nobody costed is not a limit. Free is pinned
// to FREE_DEFAULT (gemini-3.5-flash-lite, $0.52/1M blended) and capped by
// FREE_MAX_MESSAGE_CHARS below, so a free account is worth at most ~10k tokens a
// message → ~100k tokens → ~$0.05. 10,000 free signups ≈ $520 total, one time.
//
// ⚠️ Those two numbers are load-bearing TOGETHER. Raising the message count, the
// char cap, or letting free reach a pricier model breaks the arithmetic — re-cost
// it before changing any of them, and re-run scripts/verify-model-cost.ts.
export const FREE_MESSAGE_LIMIT = 10;

// A free message is only a bounded unit if its INPUT is bounded. The paid path
// allows 100k chars (~25k tokens) per message so a real document paste survives;
// at that size 10 free messages would be ~300k tokens, 3x the costing above. These
// are the free-tier equivalents — generous enough for a genuine try, small enough
// that the per-signup cost stays a rounding error.
// ⚠️ Same invariant as the paid pair: the history budget MUST exceed the
// per-message cap, or a big paste is evicted on the next turn.
export const FREE_MAX_MESSAGE_CHARS   = 12_000;
export const FREE_HISTORY_CHAR_BUDGET = 16_000;

export const MODUS_TOKEN_LIMIT  = 500_000;
export const PILOT_TOKEN_LIMIT  = 1_500_000;
export const MODUS_WEEKLY_LIMIT = MODUS_TOKEN_LIMIT * 7;
export const PILOT_WEEKLY_LIMIT = PILOT_TOKEN_LIMIT * 7;

// What ONE purchased limits add-on adds, on top of whatever the plan already
// gives. Stackable — the users doc stores a quantity and the ceiling is
// base + qty * this. See planCeilings() in lib/plan.ts, which is the only place
// these are combined, and LIMIT_ADDON in lib/pricing.ts for why it costs $10.
export const LIMIT_ADDON_DAILY  = 500_000;
export const LIMIT_ADDON_WEEKLY = LIMIT_ADDON_DAILY * 7;
