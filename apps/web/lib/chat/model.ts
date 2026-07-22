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

/**
 * Vercel AI Gateway — an OpenAI-compatible endpoint in front of ~300 models.
 *
 * MODUS's free floor used to be Groq, which decommissions meta/llama-3.3-70b
 * and meta/llama-3.1-8b on 2026-08-16 (console.groq.com/docs/deprecations, free
 * AND developer tier). That looked like losing the floor. It wasn't: Llama is
 * OPEN-WEIGHT and Groq was only ever one host of it. The Gateway serves the same
 * weights, so this is a host swap, not a model migration — which is why none of
 * the ~13 call sites below needed their token budgets re-measured.
 *
 * Reasons this beats Groq's own replacement path (openai/gpt-oss-120b):
 *  - gpt-oss is a REASONER. Measured on the real API: it returns content='' at
 *    maxTokens 80 (memory.ts's budget), so a drop-in swap would have silently
 *    killed long-term memory extraction with no error to log.
 *  - Groq's free tier caps ~12k tokens/min ORG-WIDE against a ~5.6k-token system
 *    prompt — about 2 messages/minute for the entire product. Verified on the
 *    Gateway: a 6,040-token prompt at maxTokens 2048 goes through, i.e. the exact
 *    request Groq rejects. The cap is gone.
 *  - Groq's Developer tier cannot be bought ("temporarily unavailable due to high
 *    demand", shut since ~May 2026), so the paid escape hatch was never available.
 *
 * ⚠️ Ids are `provider/model` and match NO prefix in the chain below — an unmatched
 * id falls through to downgradedToFree() and is served by Llama SILENTLY. Route
 * them via GATEWAY_HOSTED, and never by pattern: 'openai/gpt-oss-120b' is an
 * OPEN-WEIGHT model the Gateway hosts, so a looser rule would POST it to OpenAI.
 */
const gateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

/** The free default, the failover chain's free link, and what downgradedToFree() serves. */
export const LLAMA_FALLBACK = 'meta/llama-3.3-70b';
/**
 * Second free model — a separate budget from the primary, so a throttled first
 * model can immediately retry here. Also the fallback in proactive-model.ts /
 * briefing.ts.
 */
const FREE_FALLBACK_SECONDARY = 'meta/llama-3.1-8b';

/**
 * Models served by the AI Gateway's OpenAI-compatible endpoint, not by the vendor
 * whose name is in the id.
 *
 * A model missing from this Set matches no prefix in resolveChatModel, falls
 * through to downgradedToFree(), and is served by Llama SILENTLY — the exact bug
 * the onServed disclosure exists to prevent, re-entering through the back door.
 * That is why routing is an explicit list and never a pattern.
 *
 * Verified live on the Gateway key (a real completion each), not from the docs.
 */
const GATEWAY_HOSTED = new Set<string>([
  LLAMA_FALLBACK,
  FREE_FALLBACK_SECONDARY,
  // Every selectable Gateway model MUST be listed here. Adding one to
  // PLATFORM_MODELS and forgetting this line is not a 404 — the id matches no
  // prefix, falls to downgradedToFree(), and the user is served Llama while the
  // chip names the model they picked.
  'meta/llama-4-maverick',
  'deepseek/deepseek-v3.1',
]);

// The concrete language-model object type (LanguageModel is `string | model`; a
// resolved chat model is always the object form).
type LM = Exclude<LanguageModel, string>;

/** Ids that promise nothing: the free defaults MODUS falls back to by design. */
const FREE_DEFAULTS = new Set<string>([LLAMA_FALLBACK, FREE_FALLBACK_SECONDARY]);

/**
 * "Did we promise the user this specific model?" — anything that isn't a free
 * default we'd have served anyway.
 *
 * This is the ONE rule, and both downgrade routes read it: the pre-flight gate
 * below (downgradedToFree) and the runtime failover in the chat route. They used
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

/**
 * Can this model be given function tools on the endpoint we call it on?
 *
 * 🪤 OpenAI's gpt-5.x reasoning family CANNOT, over /v1/chat/completions — which
 * is the endpoint @ai-sdk/openai uses by default:
 *
 *   Function tools with reasoning_effort are not supported for gpt-5.6-terra in
 *   /v1/chat/completions. To use function tools, use /v1/responses or set
 *   reasoning_effort to 'none'.
 *
 * It is a hard 400, so attaching MCP tools to a PILOT user's best model turned
 * every message into a blank bubble. Tools are best-effort; an answer is not.
 * Dropping the tools costs a capability the user probably wasn't invoking on
 * that turn — sending them costs the entire reply.
 *
 * Kept as an allow-by-default deny-list: a model we know nothing about keeps its
 * tools, because the failure mode of guessing "no tools" is silent capability
 * loss, which is far harder to notice than an error.
 */
export function modelSupportsTools(id: string): boolean {
  return !/^gpt-5/.test(canonicalModelId(id));
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
function downgradedToFree(requested: string): ResolvedChatModel {
  const requestedPremium = isPremiumModel(requested) ? requested : undefined;
  return {
    model: gateway(LLAMA_FALLBACK),
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
    return downgradedToFree(selectedModel);
  }

  // Gateway-hosted models FIRST — they match no prefix, and a looser rule would
  // actively mis-route 'openai/…' ids to OpenAI. See GATEWAY_HOSTED.
  if (GATEWAY_HOSTED.has(selectedModel) && process.env.AI_GATEWAY_API_KEY?.trim()) {
    return served(gateway(selectedModel), selectedModel);
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
  return downgradedToFree(selectedModel);
}

// Provider errors worth failing over on: transient rate / size / availability
// limits (Groq's per-minute TPM 429 "request too large", overload, 5xx). NOT
// auth/config errors — those would fail on every model, so retrying is pointless.
// HTTP codes worth trying the next model for. 429 rate limit, 5xx availability.
const FAILOVER_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

/**
 * Walk an error chain for a retryable HTTP status.
 *
 * String matching alone is NOT enough, and that gap took the whole chat down on
 * 2026-07-22: the AI Gateway's free-tier rejection reads "...are rate-limited",
 * and `AI_RetryError`'s own message is "Failed after 3 attempts. Last error: …".
 * Hyphenated "rate-limited" does not contain "rate limit", and the 429 lives on
 * `.lastError.statusCode` / `.errors[].statusCode` — never in the string. So
 * isFailoverError returned false for a textbook 429, no fallback was tried, and
 * the user got nothing at all instead of an answer from the next model.
 * Status codes are structured data; read them as such.
 */
function hasFailoverStatus(err: unknown, depth = 0, seen = new Set<unknown>()): boolean {
  if (!err || typeof err !== 'object' || depth > 4 || seen.has(err)) return false;
  seen.add(err);
  const o = err as Record<string, unknown>;
  for (const key of ['statusCode', 'status'] as const) {
    const v = o[key];
    if (typeof v === 'number' && FAILOVER_STATUS.has(v)) return true;
  }
  // AI_RetryError nests the provider errors it gave up on.
  if (hasFailoverStatus(o.lastError, depth + 1, seen)) return true;
  if (hasFailoverStatus(o.cause, depth + 1, seen)) return true;
  if (Array.isArray(o.errors) && o.errors.some(e => hasFailoverStatus(e, depth + 1, seen))) return true;
  return false;
}

// Provider errors worth failing over on: transient rate / size / availability
// limits (Groq's per-minute TPM 429 "request too large", overload, 5xx). NOT
// auth/config errors — those would fail on every model, so retrying is pointless.
function isFailoverError(err: unknown): boolean {
  if (hasFailoverStatus(err)) return true;
  // Fold -/_ to spaces so "rate-limited", "rate_limit" and "ratelimited" all
  // match the same phrase "rate limit" does.
  const s = String(err).toLowerCase().replace(/[-_]+/g, ' ');
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
  if (process.env.AI_GATEWAY_API_KEY?.trim()) add(gateway(FREE_FALLBACK_SECONDARY));
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (openAIKey) add(createOpenAI({ apiKey: openAIKey })('gpt-4o-mini'));
  return chain;
}
