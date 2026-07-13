import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import { isPaidPlan, isPilotLevelPlan } from '@/lib/plan';

const OPENAI_VISION = /gpt-4o|gpt-4\.1|gpt-4-turbo/;
function visionOpenAIModel(model: string): string {
  return OPENAI_VISION.test(model) ? model : 'gpt-4o-mini';
}

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY ?? '', baseURL: 'https://api.groq.com/openai/v1' });
export const LLAMA_FALLBACK = 'llama-3.3-70b-versatile';
// Second free Groq model — a SEPARATE per-minute (TPM) budget from the primary
// Llama, so a throttled first model can immediately retry here at no cost. Also
// used as the fallback in proactive-model.ts / briefing.ts.
const GROQ_FALLBACK_SECONDARY = 'llama-3.1-8b-instant';

// The concrete language-model object type (LanguageModel is `string | model`; a
// resolved chat model is always the object form).
type LM = Exclude<LanguageModel, string>;

/** A premium (paid-tier) model id — anything that isn't the free Llama default. */
function isPremiumModel(id: string): boolean {
  return /^(gpt-|claude-|gemini-|grok-)/.test(id) || id === 'o4-mini';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveChatModel(userData: Record<string, any>, opts: { hasImage?: boolean; modelId?: string } = {}): ResolvedChatModel {
  const hasImage = opts.hasImage ?? false;
  const ms = userData.settings?.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
  const modelProvider = ms?.provider ?? 'platform';
  const plan = userData.plan as string | undefined;
  const isPaid = isPaidPlan(plan);
  const isPilot = isPilotLevelPlan(plan);

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

  const selectedModel = opts.modelId ?? ms?.model ?? LLAMA_FALLBACK;

  // If image attached and we'd fall back to text-only Groq, route to OpenAI vision
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (hasImage && openAIKey) {
    const id = visionOpenAIModel(selectedModel);
    return served(createOpenAI({ apiKey: openAIKey })(id), id);
  }

  // Platform routing by model prefix + plan gate
  if ((selectedModel.startsWith('gpt-') || selectedModel === 'o4-mini') && isPaid && openAIKey) {
    return served(createOpenAI({ apiKey: openAIKey })(selectedModel), selectedModel);
  }

  if (selectedModel.startsWith('claude-') && isPaid) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    // Opus is PILOT-only; Sonnet is MODUS+
    const opusRequiresPilot = selectedModel.includes('opus');
    if (anthropicKey && (!opusRequiresPilot || isPilot)) {
      return served(createAnthropic({ apiKey: anthropicKey })(selectedModel), selectedModel);
    }
  }

  if (selectedModel.startsWith('gemini-') && isPilot) {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (googleKey) {
      return served(createGoogleGenerativeAI({ apiKey: googleKey })(selectedModel), selectedModel);
    }
  }

  if (selectedModel.startsWith('grok-') && isPilot) {
    const xaiKey = process.env.XAI_API_KEY?.trim();
    if (xaiKey) {
      return served(createXai({ apiKey: xaiKey })(selectedModel), selectedModel);
    }
  }

  // Default: Groq Llama — fast, free, always available. If we got here despite a
  // premium model being requested (missing provider key or plan gate), flag it as
  // a downgrade so the caller can tell the user instead of passing Llama off as
  // the model they picked.
  const requestedPremium = isPremiumModel(selectedModel) ? selectedModel : undefined;
  return {
    model: groq(LLAMA_FALLBACK),
    modelId: LLAMA_FALLBACK,
    downgraded: !!requestedPremium,
    requestedId: requestedPremium,
  };
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
 */
export function createFallbackModel(
  models: LM[],
  onFallback?: (fromId: string, toId: string, err: unknown) => void,
): LM {
  if (models.length <= 1) return models[0];
  const attempt = async <T>(run: (m: LM) => PromiseLike<T>): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < models.length; i++) {
      try {
        return await run(models[i]);
      } catch (e) {
        lastErr = e;
        if (i < models.length - 1 && isFailoverError(e)) {
          onFallback?.(models[i].modelId, models[i + 1].modelId, e);
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
