import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

/**
 * Resolve the language model for a chat request.
 *
 * Priority: BYOK keys (OpenAI / Anthropic) → platform default. On the platform
 * tier, `gpt-*` models route to OpenAI for paid users (when a server key
 * exists) and otherwise fall back to Groq (`llama-3.1-8b-instant` for gpt-*
 * requests, the selected llama model otherwise).
 *
 * When `hasImage` is set, we must end up on a vision-capable model — the default
 * Groq llama models are text-only, so an attached image would otherwise be
 * silently dropped. We coerce to a vision model wherever one is reachable.
 */
const OPENAI_VISION = /gpt-4o|gpt-4\.1|gpt-4-turbo/;
function visionOpenAIModel(model: string): string {
  return OPENAI_VISION.test(model) ? model : 'gpt-4o-mini';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveChatModel(userData: Record<string, any>, opts: { hasImage?: boolean } = {}): LanguageModel {
  const hasImage = opts.hasImage ?? false;
  const key = process.env.GROQ_API_KEY ?? '';
  const ms = userData.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
  const modelProvider = ms?.provider ?? 'platform';

  if (modelProvider === 'openai' && ms?.openaiKey) {
    const model = ms.model ?? 'gpt-4o-mini';
    return createOpenAI({ apiKey: ms.openaiKey })(hasImage ? visionOpenAIModel(model) : model);
  }
  if (modelProvider === 'anthropic' && ms?.anthropicKey) {
    // All Claude 3+ models are vision-capable — no coercion needed.
    return createAnthropic({ apiKey: ms.anthropicKey })(ms.model ?? 'claude-sonnet-4-6');
  }

  // Platform default: route by model name — gpt-* goes to OpenAI (paid only), llama-* goes to Groq
  const platformPlan = userData.plan as string | undefined;
  const isPaid = platformPlan === 'modus' || platformPlan === 'pilot';
  const selectedModel = ms?.model ?? 'llama-3.3-70b-versatile';
  const openAIKey = process.env.OPENAI_API_KEY?.trim().replace(/\s/g, '');

  // Image present but the platform default is text-only Groq: route to OpenAI
  // vision when a server key exists (the only way the image can be understood).
  // Cheap model, and gated behind actually attaching an image.
  if (hasImage && openAIKey) {
    return createOpenAI({ apiKey: openAIKey })('gpt-4o-mini');
  }

  const wantsOpenAI = selectedModel.startsWith('gpt') && isPaid && openAIKey;
  if (wantsOpenAI) {
    return createOpenAI({ apiKey: openAIKey })(hasImage ? visionOpenAIModel(selectedModel) : selectedModel);
  }
  // gpt-* without BYOK falls back to llama-3.1-8b-instant (500k TPD, separate quota bucket)
  const groqModel = selectedModel.startsWith('gpt') ? 'llama-3.1-8b-instant' : selectedModel;
  return createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key })(groqModel);
}
