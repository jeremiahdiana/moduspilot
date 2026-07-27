/**
 * What a token from each model ACTUALLY costs us, expressed as a weight.
 *
 * 🚨 THE BUG THIS EXISTS TO FIX: `trackTokenUsage` incremented the daily/weekly
 * counters with the raw token count, so a Llama 3.3 token and a Claude Fable 5
 * token consumed the same budget. They do not cost the same. Fable 5 is $10/$50
 * per 1M against Llama's ~$0.60 blended — roughly 24x. The ceiling in
 * lib/constants.ts was therefore a TOKEN ceiling that bounded nothing about spend.
 *
 * Measured exposure before this landed: PILOT_WEEKLY_LIMIT is 10.5M tokens. Spent
 * entirely on Fable 5 at a realistic 90/10 input/output mix that is ~$147/week,
 * about $640/month, against a $59/month subscription. The all-output worst case
 * was ~$2,275/month.
 *
 * With weighting the same 10.5M budget buys ~437k Fable 5 tokens, which is ~$6/week
 * or ~$26/month — under half of PILOT revenue, which is where inference should sit.
 * The cheap models are effectively unchanged. That is the whole point: the cap now
 * bounds DOLLARS, and a user who sticks to Gemini Flash still gets the full 10.5M.
 *
 * ## Prices
 * Verified 2026-07-27 against published per-1M rates, and consistent with the
 * figures already recorded in lib/models.ts and app/api/chat/route.ts:
 *
 *   claude-fable-5          $10 / $50     gpt-5.6-sol       $5   / $30
 *   claude-opus-4-8         $5  / $25     gpt-5.6-terra     $2.50/ $15
 *   claude-sonnet-5         $3  / $15     gemini-3.1-pro    $2   / $12
 *
 * ⚠️ ESTIMATED, not verified: gemini-3.5-flash, both Llamas and DeepSeek V3.1. No
 * published per-1M rate was found for them at the versions we serve, so they are
 * set deliberately HIGH rather than low. Under-weighting is the failure that costs
 * money; over-weighting only makes a cheap model's budget slightly stricter.
 *
 * ## The blend
 * Weights use a 90% input / 10% output mix, which is what chat looks like: a 5.3k
 * system prompt plus history dwarfs the answer on almost every turn. This
 * UNDERSTATES cost for long generations and overstates it for one-line replies.
 * If real usage data later shows a different ratio, change BLEND and nothing else.
 */
import { canonicalModelId } from '@/lib/models';

/** Share of tokens that are input, for the blended price. */
const BLEND = { input: 0.9, output: 0.1 };

/** Published $/1M. `est: true` means no published rate was found. */
const PRICES: Record<string, { in: number; out: number; est?: boolean }> = {
  'claude-fable-5':         { in: 10,   out: 50 },
  'gpt-5.6-sol':            { in: 5,    out: 30 },
  'claude-opus-4-8':        { in: 5,    out: 25 },
  'claude-sonnet-5':        { in: 3,    out: 15 },
  'gpt-5.6-terra':          { in: 2.5,  out: 15 },
  'gemini-3.1-pro-preview': { in: 2,    out: 12 },
  'deepseek/deepseek-v3.1': { in: 0.8,  out: 1.6, est: true },
  'meta/llama-4-maverick':  { in: 0.8,  out: 1.6, est: true },
  'meta/llama-3.3-70b':     { in: 0.5,  out: 1.2, est: true },
  'gemini-3.5-flash':       { in: 0.3,  out: 2.5, est: true },
};

const blended = (p: { in: number; out: number }) => p.in * BLEND.input + p.out * BLEND.output;

/** The cheapest model's blended price. Its weight is 1 and everything scales off it. */
const BASELINE = Math.min(...Object.values(PRICES).map(blended));

/**
 * The weight applied to an unknown model id.
 *
 * 🔑 Deliberately the MAXIMUM weight in the table, not the average and not 1.
 * An id that is not here is far more likely to be a frontier model somebody added
 * to lib/models.ts without touching this file than a new cheap one. Failing
 * expensive means a new model is briefly over-billed against the budget. Failing
 * cheap means it is served at a loss until somebody notices, which is exactly the
 * failure mode this module was written to end.
 *
 * scripts/verify-model-cost.ts fails the build if any catalog model is missing
 * here, so this should never actually be reached in production.
 */
const UNKNOWN_WEIGHT = Math.max(...Object.values(PRICES).map(p => Math.ceil(blended(p) / BASELINE)));

/**
 * Multiplier on the raw token count for budget accounting. Always >= 1.
 *
 * Rounded UP so no model is ever under-billed against the ceiling.
 */
export function costWeight(modelId: string): number {
  const price = PRICES[canonicalModelId(modelId)] ?? PRICES[modelId];
  if (!price) return UNKNOWN_WEIGHT;
  return Math.max(1, Math.ceil(blended(price) / BASELINE));
}

/**
 * Raw tokens → budget units. This is what the daily/weekly counters must store.
 */
export function weightedTokens(modelId: string, rawTokens: number): number {
  if (!Number.isFinite(rawTokens) || rawTokens <= 0) return 0;
  return Math.ceil(rawTokens * costWeight(modelId));
}

/** Rough dollar cost of a request, for logging and the cost report script. */
export function estimatedCostUsd(modelId: string, rawTokens: number): number {
  const price = PRICES[canonicalModelId(modelId)] ?? PRICES[modelId];
  if (!price || !Number.isFinite(rawTokens) || rawTokens <= 0) return 0;
  return (rawTokens / 1_000_000) * blended(price);
}

/** Every model that has a published (non-estimated) price. Used by the verifier. */
export function pricedModelIds(): string[] {
  return Object.keys(PRICES);
}

/** True when the price is an estimate rather than a published rate. */
export function isEstimatedPrice(modelId: string): boolean {
  return (PRICES[canonicalModelId(modelId)] ?? PRICES[modelId])?.est === true;
}
