export const GUEST_DAILY_LIMIT  = 5;
export const TRIAL_DAYS         = 3;
export const TRIAL_MS           = TRIAL_DAYS * 24 * 60 * 60 * 1000;

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

// ── The surfaces that spend money OUTSIDE the token ceiling ──────────────────
//
// 🚨 EVERYTHING ABOVE BOUNDS CHAT. Nothing above bounds voice or images. Voice-out,
// voice-in and image generation each call a paid API on their own counter, none of
// which is weighted, tracked or subject to MODUS_TOKEN_LIMIT — so the careful work
// that turned the chat ceiling into a DOLLAR ceiling stopped at the edge of chat.
//
// 💸 WHAT THE OLD CAPS ACTUALLY AUTHORISED, once multiplied by a price (they were
// counted in CALLS, and a call's cost varies by an order of magnitude with length —
// the exact mistake watch mode made with "12 looks an hour"):
//
//   TTS PILOT : 2,000 calls/day x 4,000 chars x $15/1M = $120/day = $3,650/month
//   TTS MODUS :   300 calls/day x 4,000 chars          =  $18/day =   $547/month
//   TTS FREE  :    30 calls/day x 4,000 chars, DAILY, FOREVER      =    $54/month
//   Images    :    20/day at gpt-image-1's DEFAULT quality         = up to $100/month
//
// against $59, $24 and $0 of revenue. The free line was the worst of them: chat's
// free allowance is 10 messages for LIFE, but the voice counter reset every
// midnight, so an account that spent its last message a year ago still had voice.
//
// The fix is to count the unit the vendor actually bills — CHARACTERS for speech,
// SECONDS for transcription, images for images — and to derive each cap from the
// subscription. scripts/verify-surface-costs.ts multiplies all of it out and fails
// if any plan can cost more than it earns.

/** OpenAI tts-1, verified 2026-08-05. tts-1-hd is $30 and we deliberately don't use it. */
export const TTS_USD_PER_1M_CHARS = 15;
/** Longest single utterance. Truncation, not rejection — a cut answer still reads. */
export const TTS_MAX_CHARS = 4_000;
// LIFETIME, matching FREE_MESSAGE_LIMIT. A daily voice allowance on a lifetime
// chat allowance is a permanent free product bolted to a trial.
export const FREE_TTS_CHARS_LIFETIME = 20_000;   // ~$0.30 once
export const MODUS_TTS_CHARS_PER_DAY = 8_000;    // ~$3.60/month
export const PILOT_TTS_CHARS_PER_DAY = 18_000;   // ~$8.10/month

/**
 * Groq whisper-large-v3. Deliberately rounded UP from the published rate:
 * under-costing is the failure that loses money.
 *
 * ⚠️ The old cap was 120 REQUESTS/hour with a 25MB body, which is unbounded in the
 * only unit that bills — an hour of audio per request would have been legal.
 */
export const TRANSCRIBE_USD_PER_HOUR = 0.15;
export const FREE_TRANSCRIBE_SECONDS_LIFETIME = 600;   // 10 min, ~$0.03 once
export const PAID_TRANSCRIBE_SECONDS_PER_DAY  = 1_200; // 20 min/day, ~$1.50/month

// 🪤 The route never passed `quality`, so it billed at OpenAI's default, which can
// be the HIGH tier at 4-6x medium. An unspecified quality is not a default, it is
// an unpriced decision handed to the vendor. It is pinned below.
// 🖼️ TWO MODELS, BY PLAN — verified present on our key 2026-08-06 via
// api.openai.com/v1/models, not assumed. A wrong image id does not error, it
// returns null and falls through to the fallback, so it degrades silently.
//
// gpt-image-1 is GONE from here: it retires 2026-10-23. dall-e-3 is gone too, it
// is older and dearer than mini.
//
// 💸 Why MODUS does not get gpt-image-2: at $0.053 a medium square, 8/day is
// $12.72/month, which on top of chat, voice-out and voice-in is $25.62 against a
// $24 plan. It would LOSE money at the ceiling. Mini is the current cheap model
// and keeps the 8/day he asked for comfortably inside the plan, so the better
// model becomes a real PILOT differentiator rather than a loss.
export const IMAGE_MODEL_STANDARD = 'gpt-image-1-mini';
export const IMAGE_MODEL_PRO      = 'gpt-image-2';
/** Conservative: mini is published as $0.005-$0.052 across quality and size, and
 *  over-costing only makes a cap slightly stricter while under-costing loses money. */
export const IMAGE_USD_EACH_STANDARD = 0.025;
/** gpt-image-2, medium, 1024x1024. Wide/portrait are cheaper ($0.041). */
export const IMAGE_USD_EACH_PRO      = 0.053;
export const IMAGE_QUALITY: 'low' | 'medium' | 'high' = 'medium';
// His call 2026-08-06: 8/day on MODUS. On gpt-image-1-mini that is ~$6.00/month and
// leaves MODUS at 79% of revenue worst case. Cache hits never consume the cap, so
// real usage sits far below this. The lever if it ever bites is IMAGE_QUALITY.
export const MODUS_IMAGES_PER_DAY = 8;    // gpt-image-1-mini, ~$6.00/month
// PILOT's edge is the MODEL (gpt-image-2) as much as the count. 12/day on the pro
// model put PILOT at 88% of revenue at the ceiling, which is too thin for the
// flagship, so 10 — still more than MODUS, on a better model, at 83%.
export const PILOT_IMAGES_PER_DAY = 10;   // gpt-image-2, ~$15.90/month
