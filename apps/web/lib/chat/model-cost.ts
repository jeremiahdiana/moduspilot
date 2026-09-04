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
 * bounds DOLLARS.
 *
 * 🚨 THE SECOND BUG, FOUND 2026-08-04. The sentence above used to end "…and a user
 * who sticks to Gemini Flash still gets the full 10.5M." That was true and it was
 * ruinous, because Flash's price here was wrong. It carried Flash-LITE's rates
 * ($0.30/$2.50) under Flash's id. Flash is $1.50/$9.00 — blended $2.25/1M, not
 * $0.52, a 4.3x understatement.
 *
 * Flash was BOTH the BASELINE every other weight divides by AND the FREE_DEFAULT
 * every unchosen request lands on, so the error was not confined to one row: the
 * ceilings bounded 4.3x more dollars than this file claimed, and PILOT's 10.5M
 * spent on Flash was ~$102/month against a $59 subscription. Same shape as the
 * gpt-4o-mini 27x bug — a price nobody re-checked — but in the direction that
 * loses money rather than the direction that shows up as an angry user.
 *
 * Fixed by pricing Flash correctly (weight 1 → 5) and re-pinning BASELINE to
 * Flash-Lite, which blends to the same $0.52 the baseline already was, so no
 * existing customer's allowance moved. See BASELINE below.
 *
 * ## Prices
 * claude-*, gpt-* and gemini-3.1-pro verified 2026-07-27; the Gemini and Llama
 * rows re-verified 2026-08-04 against ai.google.dev/gemini-api/docs/pricing and
 * vercel.com/ai-gateway/models/llama-3.3-70b:
 *
 *   claude-fable-5          $10  / $50    gpt-5.6-sol            $5   / $30
 *   claude-opus-4-8         $5   / $25    gpt-5.6-terra          $2.50/ $15
 *   claude-sonnet-5         $3   / $15    gemini-3.1-pro         $2   / $12
 *   gemini-3.5-flash        $1.50/ $9     gemini-3.5-flash-lite  $0.30/ $2.50
 *   meta/llama-3.3-70b      $0.59/ $0.72
 *
 * ⚠️ STILL ESTIMATED, not verified: llama-4-maverick, llama-3.1-8b, DeepSeek V3.1.
 * No published per-1M rate was found for them at the versions we serve, so they are
 * set deliberately HIGH rather than low. Under-weighting is the failure that costs
 * money; over-weighting only makes a cheap model's budget slightly stricter.
 *
 * 🪤 A model's price is not a fact you look up once. Re-verify a row before you
 * trust it in an argument about margin — the Flash bug survived a whole audit
 * because `est: true` looked like a hedge rather than a thing to go check.
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
  'meta/llama-3.3-70b':     { in: 0.59, out: 0.72 },
  // 🚨 WAS { in: 0.3, out: 2.5, est: true } — which are FLASH-LITE's prices, not
  // Flash's. Same family, adjacent rows on Google's pricing page, wrong one taken.
  // Real Flash is 5x the input and 3.6x the output: $0.52 blended → $2.25, a 4.3x
  // understatement of the model that was BOTH the BASELINE and the FREE_DEFAULT.
  // Consequences before this line was fixed:
  //   · the ceilings bounded 4.3x more dollars than this file claimed
  //   · PILOT's weekly budget on Flash was ~$102/mo against a $59 subscription,
  //     not the "~$26/month, under half of PILOT revenue" asserted above
  // ⚠️ Google bills THINKING TOKENS at the output rate, and Flash thinks by
  // default, so the 90/10 blend understates it further on reasoning-heavy turns.
  'gemini-3.5-flash':       { in: 1.5,  out: 9.0 },
  // The baseline, the free default, and the free tier's only model. See BASELINE.
  'gemini-3.5-flash-lite':  { in: 0.3,  out: 2.5 },

  // ── The INTERNAL models. Not selectable Brains, but requests land on them ──
  //
  // 🚨 THESE WERE MISSING, AND IT WAS EXPENSIVE IN THE WRONG DIRECTION. They are
  // not in PLATFORM_MODELS, so verify-model-cost.ts — which walked the catalog —
  // never noticed, and costWeight() fell through to UNKNOWN_WEIGHT = 27x.
  //
  // gpt-4o-mini is the cheapest thing we serve AND the model that production's
  // resolveChatModel forces EVERY image request onto. So every screenshot, every
  // attached photo, was billed against the user's ceiling at 27x — the same weight
  // as Claude Fable 5, which genuinely costs ~66x more. Measured on a real account:
  // one Screen Assist question came to ~354,000 units of a 500,000/day allowance.
  // One and a half questions a day.
  //
  // ⚠️ est: no published rate re-verified at this date; set deliberately high per
  // the note above. Even so they land at weight 1, which is the honest floor for
  // the two cheapest models in the system.
  'gpt-4o-mini':            { in: 0.15, out: 0.6, est: true },
  'meta/llama-3.1-8b':      { in: 0.3,  out: 0.6, est: true },
};

const blended = (p: { in: number; out: number }) => p.in * BLEND.input + p.out * BLEND.output;

/**
 * The reference price. Weight 1 is defined as "costs this much"; everything scales
 * off it.
 *
 * 🪤 PINNED TO A NAMED MODEL, NOT Math.min(). It used to be the minimum across the
 * whole table, which meant adding ONE cheaper model silently re-scaled every other
 * weight upward and tightened every customer's effective allowance overnight, with
 * no pricing decision and no changelog. Adding gpt-4o-mini below would have done
 * exactly that: baseline $0.52 → $0.195, multiplying every premium model's weight
 * by ~2.7x and cutting what a PILOT subscriber could actually use to a third.
 *
 * gemini-3.5-flash-lite is the free default and the floor of the catalog, so it is
 * the natural unit. Models cheaper than it simply clamp to 1 via costWeight's
 * Math.max. Changing this line changes every customer's budget — that is a pricing
 * decision, and it should have to be made deliberately rather than fall out of
 * adding a row.
 *
 * 🔑 WHY FLASH-LITE AND NOT CORRECTED FLASH. When Flash's price was fixed above,
 * re-pinning to Flash would have raised BASELINE 0.52 → 2.25 and DIVIDED every
 * premium weight by 4.3 — quietly handing every paying customer 4.3x more budget.
 * A PILOT user could then burn ~$91/mo of Fable 5 on a $59 plan. Flash-Lite blends
 * to $0.52, which is EXACTLY the number this baseline already was, so correcting
 * the Flash bug changed no existing customer's allowance by a single unit. That
 * equality is not a coincidence to rely on forever — it is why the before/after
 * weight diff in scripts/verify-model-cost.ts is the gate on this change.
 */
const BASELINE = blended(PRICES['gemini-3.5-flash-lite']);

/**
 * What ONE budget unit costs in dollars, exported so anything converting the
 * ceilings back into money uses this number rather than a copy of it.
 *
 * A unit is one token at the baseline model's blended rate, so
 * `units / 1e6 * BASELINE_USD_PER_1M` is the spend a ceiling authorises.
 * scripts/verify-surface-costs.ts is the caller: it turns MODUS_WEEKLY_LIMIT and
 * PILOT_WEEKLY_LIMIT into monthly dollars and checks them against the subscription.
 * Hardcoding 0.52 there is exactly how the Flash mispricing survived — a number
 * copied out of a comment cannot go stale loudly.
 */
export const BASELINE_USD_PER_1M = BASELINE;

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
