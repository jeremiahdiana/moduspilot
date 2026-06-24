import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';

const OPENAI_VISION = /gpt-4o|gpt-4\.1|gpt-4-turbo/;
function visionOpenAIModel(model: string): string {
  return OPENAI_VISION.test(model) ? model : 'gpt-4o-mini';
}

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY ?? '', baseURL: 'https://api.groq.com/openai/v1' });
const LLAMA_FALLBACK = 'llama-3.3-70b-versatile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveChatModel(userData: Record<string, any>, opts: { hasImage?: boolean } = {}): LanguageModel {
  const hasImage = opts.hasImage ?? false;
  const ms = userData.settings?.modelSettings as { provider?: string; model?: string; openaiKey?: string; anthropicKey?: string } | undefined;
  const modelProvider = ms?.provider ?? 'platform';
  const plan = userData.plan as string | undefined;
  const isPaid = plan === 'modus' || plan === 'pilot';
  const isPilot = plan === 'pilot';

  // BYOK — user's own key always wins, regardless of plan
  if (modelProvider === 'openai' && ms?.openaiKey) {
    const model = ms.model ?? 'gpt-4o';
    return createOpenAI({ apiKey: ms.openaiKey })(hasImage ? visionOpenAIModel(model) : model);
  }
  if (modelProvider === 'anthropic' && ms?.anthropicKey) {
    return createAnthropic({ apiKey: ms.anthropicKey })(ms.model ?? 'claude-sonnet-4-6');
  }

  const selectedModel = ms?.model ?? LLAMA_FALLBACK;

  // If image attached and we'd fall back to text-only Groq, route to OpenAI vision
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (hasImage && openAIKey) {
    return createOpenAI({ apiKey: openAIKey })(visionOpenAIModel(selectedModel));
  }

  // Platform routing by model prefix + plan gate
  if ((selectedModel.startsWith('gpt-') || selectedModel === 'o4-mini') && isPaid && openAIKey) {
    return createOpenAI({ apiKey: openAIKey })(selectedModel);
  }

  if (selectedModel.startsWith('claude-') && isPaid) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    // Opus is PILOT-only; Sonnet is MODUS+
    const opusRequiresPilot = selectedModel.includes('opus');
    if (anthropicKey && (!opusRequiresPilot || isPilot)) {
      return createAnthropic({ apiKey: anthropicKey })(selectedModel);
    }
  }

  if (selectedModel.startsWith('gemini-') && isPilot) {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (googleKey) {
      return createGoogleGenerativeAI({ apiKey: googleKey })(selectedModel);
    }
  }

  if (selectedModel.startsWith('grok-') && isPilot) {
    const xaiKey = process.env.XAI_API_KEY?.trim();
    if (xaiKey) {
      return createXai({ apiKey: xaiKey })(selectedModel);
    }
  }

  // Default: Groq Llama — fast, free, always available
  return groq(LLAMA_FALLBACK);
}
