import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import { canonicalModelId, isModelUnlocked, PLATFORM_MODELS } from '@/lib/models';

// gpt-5.6-* included because it IS multimodal — verified 2026-07-16 by sending a
// real image and getting the colour back. Without it, a paying user on Terra who
// attaches an image is silently answered by gpt-4o-mini instead.
const OPENAI_VISION = /gpt-5\.6|gpt-4o|gpt-4\.1|gpt-4-turbo/;
function visionOpenAIModel(model: string): string {
  return OPENAI_VISION.test(model) ? model : 'gpt-4o-mini';
}

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY ?? '', baseURL: 'https://api.groq.com/openai/v1' });

// 🚨 BOTH MODELS BELOW ARE DECOMMISSIONED ON 2026-08-16 — after that date Groq
// will not serve them at all (console.groq.com/docs/deprecations, confirmed in the
// deprecation email of 2026-06-30; applies to free AND developer tier).
//
// That is not one model expiring, it is the FLOOR of the whole product: the free
// default, the failover chain's free link, and whatever downgradedToLlama() hands
// back when anything else fails. Nothing else in the catalog is free.
//
// Groq's replacements are openai/gpt-oss-120b (for 3.3) and openai/gpt-oss-20b
// (for 3.1) — BOTH ARE REASONERS. Measured 2026-07-17 on the free tier:
// gpt-oss-120b returns finish='length' at maxTokens 2048 (truncated mid-answer),
// and raising it to 16000 is rejected with "Request too large" by the free 12k/min
// org cap. So the migration needs a Groq card (no minimum spend) AND isReasoningModel
// widened in chat/route.ts + compare/route.ts, or paying users get cut-off answers.
// qwen/qwen3.6-27b is the other suggestion and emits raw <think> into content.
export const LLAMA_FALLBACK = 'llama-3.3-70b-versatile';
// Second free Groq model — a SEPARATE per-minute (TPM) budget from the primary
// Llama, so a throttled first model can immediately retry here at no cost. Also
// used as the fallback in proactive-model.ts / briefing.ts.
const GROQ_FALLBACK_SECONDARY = 'llama-3.1-8b-instant';

/**
 * Models served by GROQ's OpenAI-compatible endpoint, not by the vendor whose
 * name is in the id.
 *
 * These CANNOT be routed by the id-prefix chain in resolveChatModel, and the
 * naming actively lies: `openai/gpt-oss-120b` is an OPEN-WEIGHT model Groq hosts,
 * so sending it to api.openai.com because it says "openai" would fail. It matches
 * no prefix either way, and an unmatched id falls through to downgradedToLlama()
 * — so a model missing from this Set is served by Llama SILENTLY. That is exactly
 * the bug the onServed disclosure exists to prevent, re-entering through the back
 * door, which is why routing is an explicit list rather than a pattern.
 *
 * Verified live on the Groq key 2026-07-17 (list + a real completion each).
 */
const GROQ_HOSTED = new Set<string>([
  LLAMA_FALLBACK,
  GROQ_FALLBACK_SECONDARY,
  // The Aug-16 migration lands here: 'openai/gpt-oss-120b' / 'openai/gpt-oss-20b'.
  // Add them ONLY with a Groq card + isReasoningModel widened — see the note above.
]);

// The concrete language-model object type (LanguageModel is `string | model`; a
// resolved chat model is always the object form).
type LM = Exclude<LanguageModel, string>;

/** Ids that promise nothing: the free defaults MODUS falls back to by design. */
const FREE_DEFAULTS = new Set<string>([LLAMA_FALLBACK, GROQ_FALLBACK_SECONDARY]);

/**
 * "Did we promise the user this specific model?" — anything that isn't a free
 * default we'd have served anyway.
 *
 * This is the ONE rule, and both downgrade routes read it: the pre-flight gate
 * below (downgradedToLlama) and the runtime failover in the chat route. They used
 * to disagree — the failover path reported nothing at all — which is how a $59
 * user could pick Gemini, be answered by Llama, and never be told.
 *
 * It is deliberately an OR of two independent tests, because each one alone has a
 * silent-downgrade hole:
 *  - The CATALOG test alone misses a stale saved Brain. Firestore stores a raw id
 *    with no backfill, so a retired id that never made it into LEGACY_MODEL_IDS
 *    (e.g. 'claude-3-opus') isn't in PLATFORM_MODELS — catalog-only would call it
 *    non-premium and drop that user to Llama in silence.
 *  - The REGEX test alone misses every Groq-hosted id: 'openai/gpt-oss-120b' and
 *    'meta-llama/llama-4-scout-…' match no prefix, so regex-only would silently
 *    downgrade the very models we add for model count.
 * Either test firing means we named a model, so the user gets told.
 */
export function isPremiumModel(id: string): boolean {
  const canonical = canonicalModelId(id);
  if (FREE_DEFAULTS.has(canonical)) return false;
  return /^(gpt-|claude-|gemini-|grok-|o4-)/.test(canonical)
    || PLATFORM_MODELS.some(m => m.id === canonical);
}

export interface ResolvedChatModel {
  model: LanguageModel;
  /** The model id actually used for this request. */
  modelId: string;
  /**
   * True when a premium model was requested but we had to fall back to the free
   * Llama default (missing provider key or plan gate). The caller surfaces this
   * instead of silently answering as if the premium model had been used.
   */
  downgraded: boolean;
  /** The premium model that was requested but not served, when downgraded. */
  requestedId?: string;
}

function served(model: LanguageModel, modelId: string): ResolvedChatModel {
  return { model, modelId, downgraded: false };
}

/** Free Llama, flagged so the caller can tell the user which model did NOT run. */
function downgradedToLlama(requested: string): ResolvedChatModel {
  const requestedPremium = isPremiumModel(requested) ? requested : undefined;
  return {
    model: groq(LLAMA_FALLBACK),
    modelId: LLAMA_FALLBACK,
    downgraded: !!requestedPremium,
    requestedId: requestedPremium,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveChatModel(userData: Record<string, any>, opts: { hasImage?: boolean; modelId?: string } = {}): ResolvedChatModel {
  const hasImage = opts.hasImage ?? false;
  const ms = userData.settings?.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
  const modelProvider = ms?.provider ?? 'platform';
  const plan = userData.plan as string | undefined;

  // Explicit per-request override (in-chat model switcher / Auto router). Routes
  // as a platform model through the plan gate below, ignoring the saved BYOK
  // provider so the user's in-chat choice wins for this message.
  if (opts.modelId) {
    // fall through to platform routing with the forced id
  } else {
    // BYOK — user's own key always wins, regardless of plan
    if (modelProvider === 'openai' && ms?.openaiKey) {
      const model = ms.model ?? 'gpt-4o';
      const id = hasImage ? visionOpenAIModel(model) : model;
      return served(createOpenAI({ apiKey: ms.openaiKey })(id), id);
    }
    if (modelProvider === 'anthropic' && ms?.anthropicKey) {
      const id = ms.model ?? 'claude-sonnet-4-6';
      return served(createAnthropic({ apiKey: ms.anthropicKey })(id), id);
    }
  }

  // canonicalModelId so a saved Brain naming a retired model (gpt-4o, grok-3, …)
  // resolves to its successor instead of failing the gate and dropping to Llama.
  const selectedModel = canonicalModelId(opts.modelId ?? ms?.model ?? LLAMA_FALLBACK);

  // If image attached and we'd fall back to text-only Groq, route to OpenAI vision
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (hasImage && openAIKey) {
    const id = visionOpenAIModel(selectedModel);
    return served(createOpenAI({ apiKey: openAIKey })(id), id);
  }

  // ONE tier gate, read off PLATFORM_MODELS[].plans.
  //
  // This used to be re-derived from id prefixes here (isPaid for gpt-*, isPilot
  // for gemini-*/grok-*, a special case for opus), which meant tiers were encoded
  // in two places that could disagree — and did. o4-mini was plans:['pilot'] in
  // the catalog but gated `isPaid` here, and because the line above falls back to
  // the ungated ms?.model, a $24 user whose saved Brain was o4-mini got served a
  // PILOT model. The prefix chain below now ONLY picks the provider SDK; it makes
  // no access decisions, so the catalog is the source of truth its header claims.
  if (!isModelUnlocked(selectedModel, plan)) {
    return downgradedToLlama(selectedModel);
  }

  // Groq-hosted models FIRST — they match no prefix, and one of them ('openai/…')
  // would be actively mis-routed to OpenAI by a looser rule. See GROQ_HOSTED.
  if (GROQ_HOSTED.has(selectedModel) && process.env.GROQ_API_KEY?.trim()) {
    return served(groq(selectedModel), selectedModel);
  }

  if (selectedModel.startsWith('gpt-') || selectedModel.startsWith('o4-')) {
    if (openAIKey) return served(createOpenAI({ apiKey: openAIKey })(selectedModel), selectedModel);
  }

  if (selectedModel.startsWith('claude-')) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (anthropicKey) return served(createAnthropic({ apiKey: anthropicKey })(selectedModel), selectedModel);
  }

  if (selectedModel.startsWith('gemini-')) {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (googleKey) return served(createGoogleGenerativeAI({ apiKey: googleKey })(selectedModel), selectedModel);
  }

  if (selectedModel.startsWith('grok-')) {
    const xaiKey = process.env.XAI_API_KEY?.trim();
    if (xaiKey) return served(createXai({ apiKey: xaiKey })(selectedModel), selectedModel);
  }

  // Default: Groq Llama — fast, free, always available. Reached when a premium
  // model was unlocked but its provider key is missing; flagged as a downgrade so
  // the caller tells the user instead of passing Llama off as the model they picked.
  return downgradedToLlama(selectedModel);
}

// Provider errors worth failing over on: transient rate / size / availability
// limits (Groq's per-minute TPM 429 "request too large", overload, 5xx). NOT
// auth/config errors — those would fail on every model, so retrying is pointless.
function isFailoverError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes('429') ||
    s.includes('rate limit') ||
    s.includes('too many') ||
    s.includes('too large') ||
    s.includes('tokens per') ||
    s.includes('reduce') ||
    s.includes('quota') ||
    s.includes('overloaded') ||
    s.includes('capacity') ||
    s.includes('503') ||
    s.includes('502')
  );
}

/**
 * Wrap an ordered list of models into a single LanguageModel that transparently
 * fails over: if a model's request is rejected with a transient rate/size/
 * availability error (e.g. Groq's per-minute TPM 429), the next model is tried.
 * Groq rejects over-limit requests at request time — BEFORE any token — so the
 * rejection surfaces here in doStream/doGenerate and the user never sees an error.
 * A Proxy is used so every other property/method delegates to the primary model.
 *
 * `onServed` reports which model ACTUALLY answered. It is the only way to know:
 * the caller's response headers are built before doStream resolves, so a switch
 * that happens here can never reach the client through them. Without it the
 * client keeps displaying (and persisting) the model we merely ATTEMPTED.
 */
export function createFallbackModel(
  models: LM[],
  opts: {
    onFallback?: (fromId: string, toId: string, err: unknown) => void;
    /** Fires with the model whose request was accepted — i.e. the one answering. */
    onServed?: (modelId: string) => void;
  } = {},
): LM {
  // One model = no switch is possible, so the caller's assumed id is already
  // correct and onServed would be pure noise.
  if (models.length <= 1) return models[0];
  const attempt = async <T>(run: (m: LM) => PromiseLike<T>): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < models.length; i++) {
      try {
        const out = await run(models[i]);
        // Resolved = the provider accepted the request. For doStream that means
        // this model is producing the answer (Groq/OpenAI reject at request time,
        // before any token), so it is safe to report it as the served model.
        opts.onServed?.(models[i].modelId);
        return out;
      } catch (e) {
        lastErr = e;
        if (i < models.length - 1 && isFailoverError(e)) {
          opts.onFallback?.(models[i].modelId, models[i + 1].modelId, e);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  };
  return new Proxy(models[0], {
    get(target, prop, receiver) {
      if (prop === 'doStream') {
        return (options: Parameters<LM['doStream']>[0]) => attempt((m) => m.doStream(options));
      }
      if (prop === 'doGenerate') {
        return (options: Parameters<LM['doGenerate']>[0]) => attempt((m) => m.doGenerate(options));
      }
      // Delegate everything else (modelId, provider, specificationVersion,
      // supportsUrl, …) to the primary model, preserving its `this`.
      void receiver;
      return Reflect.get(target, prop, target);
    },
  });
}

/**
 * Build the ordered failover chain for a chat request: the resolved primary model
 * first, then a free Groq model with a SEPARATE TPM budget, then a paid safety net
 * (gpt-4o-mini) so MODUS ALWAYS answers instead of surfacing "ran out / too long".
 * Duplicates (e.g. primary already gpt-4o-mini) are skipped.
 */
export function chatFallbackChain(primary: LM): LM[] {
  const chain: LM[] = [primary];
  const seen = new Set<string>([primary.modelId]);
  const add = (model: LM) => {
    if (seen.has(model.modelId)) return;
    seen.add(model.modelId);
    chain.push(model);
  };
  if (process.env.GROQ_API_KEY?.trim()) add(groq(GROQ_FALLBACK_SECONDARY));
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (openAIKey) add(createOpenAI({ apiKey: openAIKey })('gpt-4o-mini'));
  return chain;
}
