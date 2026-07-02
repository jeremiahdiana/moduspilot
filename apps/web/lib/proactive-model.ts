import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import { isPaidPlan } from '@/lib/plan';

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY ?? '',
  baseURL: 'https://api.groq.com/openai/v1',
});

/**
 * Model chain for MODUS's proactive/background jobs (inbox triage, briefings,
 * etc.). Paid users lead with a frontier model (Claude Sonnet 4.6); everyone
 * falls back to Groq Llama (fast + free). Callers try each in order until one
 * succeeds. Now that MODUS is fully paid, "paid" is effectively every active
 * user — free/grandfathered accounts stay on Llama.
 */
export function proactiveModels(plan: string | null | undefined): LanguageModel[] {
  const models: LanguageModel[] = [];
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (isPaidPlan(plan) && anthropicKey) {
    models.push(createAnthropic({ apiKey: anthropicKey })('claude-sonnet-4-6'));
  }
  models.push(groq('llama-3.3-70b-versatile'), groq('llama-3.1-8b-instant'));
  return models;
}

/**
 * Run a proactive-job prompt through the plan-appropriate model chain, falling
 * back to the next model on failure. Returns the raw text, or throws if every
 * model fails (callers typically skip that item).
 */
export async function generateProactiveText(args: {
  plan: string | null | undefined;
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  let lastErr: unknown;
  for (const model of proactiveModels(args.plan)) {
    try {
      const { text } = await generateText({
        model,
        ...(args.system ? { system: args.system } : {}),
        prompt: args.prompt,
        maxTokens: args.maxTokens ?? 600,
      });
      return text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('all proactive models failed');
}
