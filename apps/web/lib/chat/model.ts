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
 * Extracted verbatim from the chat route — behavior unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveChatModel(userData: Record<string, any>): LanguageModel {
  const key = process.env.GROQ_API_KEY ?? '';
  const ms = userData.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
  const modelProvider = ms?.provider ?? 'platform';

  if (modelProvider === 'openai' && ms?.openaiKey) {
    return createOpenAI({ apiKey: ms.openaiKey })(ms.model ?? 'gpt-4o-mini');
  }
  if (modelProvider === 'anthropic' && ms?.anthropicKey) {
    return createAnthropic({ apiKey: ms.anthropicKey })(ms.model ?? 'claude-sonnet-4-6');
  }

  // Platform default: route by model name — gpt-* goes to OpenAI (paid only), llama-* goes to Groq
  const platformPlan = userData.plan as string | undefined;
  const isPaid = platformPlan === 'modus' || platformPlan === 'pilot';
  const selectedModel = ms?.model ?? 'llama-3.3-70b-versatile';
  const openAIKey = process.env.OPENAI_API_KEY?.trim().replace(/\s/g, '');
  const wantsOpenAI = selectedModel.startsWith('gpt') && isPaid && openAIKey;
  if (wantsOpenAI) {
    return createOpenAI({ apiKey: openAIKey })(selectedModel);
  }
  // gpt-* without BYOK falls back to llama-3.1-8b-instant (500k TPD, separate quota bucket)
  const groqModel = selectedModel.startsWith('gpt') ? 'llama-3.1-8b-instant' : selectedModel;
  return createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key })(groqModel);
}
