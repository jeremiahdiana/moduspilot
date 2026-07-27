/**
 * Reasoning effort, mapped to each provider's own spelling of it.
 *
 * ## Why this is not just a number we pass through
 *
 * There is no portable "effort" parameter on ai@4.3.19. The normalised top-level
 * `reasoning` option is AI SDK v5+/Gateway; on the v4 provider packages this repo
 * pins (@ai-sdk/openai 1.3.24, @ai-sdk/anthropic 1.2.12, @ai-sdk/google 1.2.22)
 * each provider takes a different shape through `providerOptions`:
 *
 *   OpenAI      openai.reasoningEffort      'low' | 'medium' | 'high'
 *   Anthropic   anthropic.thinking          { type: 'enabled', budgetTokens }
 *   Google      google.thinkingConfig       { thinkingBudget }
 *
 * Llama 3.3 and DeepSeek V3.1 take none of these. That is deliberate, not an
 * oversight: both are the NON-thinking variants, chosen in lib/models.ts because
 * reasoners return '' at small caps. isReasoningModel() in model-params.ts is the
 * existing, measured list of which models this can apply to, so effort keys off
 * that rather than a second hand-maintained list that can drift from it.
 *
 * ## 🚨 Why MEDIUM sends nothing at all
 *
 * Medium IS the provider default. OpenAI's reasoningEffort defaults to 'medium',
 * and Claude 5 thinks adaptively with no budget set. So "default to medium to save
 * tokens" saves nothing — it is the behaviour that is already shipping.
 *
 * Sending nothing on medium is also the safe choice, and that matters more here
 * than tidiness. Explicitly enabling Anthropic `thinking` is a DIFFERENT mode from
 * adaptive, and this codebase has been bitten repeatedly by the blank-bubble
 * failure around thinking blocks (see lib/chat/stream-repair.ts and the measured
 * note at app/api/chat/route.ts:695). Medium therefore changes no bytes on the
 * wire, and the default carries zero regression risk. LOW is where the saving is.
 *
 * ## Why maxTokens is NOT the lever
 *
 * Measured, from route.ts:695 — gpt-5.6-sol at a 2048 cap spent all 2048 on
 * reasoning and returned finishReason 'length' with ZERO visible characters. Effort
 * must reduce THINKING; the 16000 cap stays as the safety ceiling. Lowering the cap
 * to save money reintroduces blank bubbles, which is the most expensive bug this
 * product has had.
 */
import type { JSONValue } from 'ai';
import { isReasoningModel } from '@/lib/chat/model-params';
import { canonicalModelId } from '@/lib/models';

/** Exactly the shape streamText's `providerOptions` accepts. */
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

export const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

/**
 * What a user gets when they have never touched the setting.
 *
 * 'medium' matches every provider's own default, so shipping this changes nothing
 * for anyone until they move the slider. Set it to 'low' to make the whole base
 * cheaper by default, which is a real product decision and not a free one: low
 * measurably weakens multi-step reasoning.
 */
export const DEFAULT_EFFORT: Effort = 'medium';

/** Anthropic requires budgetTokens >= 1024, and it must stay under maxTokens (16000). */
const ANTHROPIC_BUDGET: Partial<Record<Effort, number>> = { low: 2048, high: 8000 };
const GOOGLE_BUDGET: Partial<Record<Effort, number>> = { low: 2048, high: 8192 };

export function isEffort(v: unknown): v is Effort {
  return typeof v === 'string' && (EFFORT_LEVELS as readonly string[]).includes(v);
}

/** Read the user's setting, falling back to the default on anything unexpected. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function effortFor(userData: Record<string, any> | undefined): Effort {
  const v = userData?.settings?.reasoningEffort;
  return isEffort(v) ? v : DEFAULT_EFFORT;
}

/** Can this model's effort be controlled at all? False for Llama 3.3 and DeepSeek V3.1. */
export function supportsEffort(modelId: string): boolean {
  return isReasoningModel(modelId);
}

/**
 * providerOptions for this model at this effort. `{}` means "send nothing", which
 * is correct for medium and for every model that cannot control effort.
 *
 * Merge this into any existing providerOptions rather than replacing them — the
 * chat route already sends anthropic.cacheControl on system messages, and dropping
 * that would silently end prompt caching and roughly triple Anthropic input cost.
 */
export function effortProviderOptions(modelId: string, effort: Effort): ProviderOptions {
  if (!supportsEffort(modelId) || effort === 'medium') return {};
  const id = canonicalModelId(modelId);

  if (/^o\d/.test(id) || /^gpt-5/.test(id)) {
    return { openai: { reasoningEffort: effort } };
  }
  if (/^claude-/.test(id)) {
    const budgetTokens = ANTHROPIC_BUDGET[effort];
    return budgetTokens ? { anthropic: { thinking: { type: 'enabled', budgetTokens } } } : {};
  }
  if (/^gemini-3/.test(id)) {
    const thinkingBudget = GOOGLE_BUDGET[effort];
    return thinkingBudget ? { google: { thinkingConfig: { thinkingBudget } } } : {};
  }
  return {};
}
