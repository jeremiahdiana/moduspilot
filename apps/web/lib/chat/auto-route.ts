import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PLATFORM_MODELS, effectivePlan } from '@/lib/models';

/**
 * Auto model routing. When a user leaves the in-chat model switcher on "Auto",
 * MODUS reads the task and picks the model best suited to it — the best writing
 * model for an essay, a reasoning model for math/code, etc. — capped to whatever
 * the user's plan unlocks.
 *
 * Classification is one fast, cheap Groq/Llama call (a few tokens out). On any
 * failure we degrade to 'general' → Llama, so Auto never blocks a chat.
 */

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY ?? '',
  baseURL: 'https://api.groq.com/openai/v1',
});

export type TaskCategory = 'writing' | 'research' | 'code' | 'reasoning' | 'general';

// Best-first model preference per task category. The router walks each list and
// picks the first model the user's plan unlocks; if none match it falls back to
// Llama (the 'general' default). Ids must exist in PLATFORM_MODELS.
const CATEGORY_PREFERENCE: Record<TaskCategory, string[]> = {
  // Nuanced, human-sounding prose — Claude leads (reads least "AI-generated").
  writing:   ['claude-sonnet-4-6', 'claude-opus-4-8', 'gpt-4o'],
  // Up-to-date / factual digging — real-time model first, then broad generalist.
  research:  ['grok-3', 'gpt-4o', 'claude-sonnet-4-6'],
  // Code & math — reliably-streaming models first; o4-mini has a recurring
  // empty-response failure mode (burns its token budget on hidden reasoning).
  code:      ['gpt-4o', 'claude-sonnet-4-6', 'o4-mini'],
  // Hard multi-step reasoning / strategy.
  reasoning: ['claude-opus-4-8', 'gpt-4o', 'claude-sonnet-4-6', 'o4-mini'],
  // Everyday chat — fast & free.
  general:   ['llama-3.3-70b-versatile'],
};

const LLAMA = 'llama-3.3-70b-versatile';

const CLASSIFIER_SYSTEM =
  `You are a task router. Read the user's most recent request and classify it into EXACTLY ONE category:\n` +
  `- writing: essays, emails, posts, copy, letters, stories, rewriting/editing prose\n` +
  `- research: questions needing current, factual, or web-sourced information\n` +
  `- code: programming, debugging, scripts, technical/engineering tasks\n` +
  `- reasoning: math, logic, planning, strategy, or hard multi-step problems\n` +
  `- general: casual conversation, quick questions, task/calendar/personal-assistant actions\n` +
  `Reply with ONLY the single category word, lowercase, nothing else.`;

function pickModel(category: TaskCategory, plan: string | null | undefined): string {
  const ep = effectivePlan(plan);
  for (const id of CATEGORY_PREFERENCE[category]) {
    const model = PLATFORM_MODELS.find(m => m.id === id);
    if (model && model.plans.includes(ep)) return id;
  }
  return LLAMA;
}

export interface RouteResult {
  category: TaskCategory;
  modelId: string;
  /** Research tasks turn web search on for the request even if not enabled by default. */
  webSearch: boolean;
}

/**
 * Classify `queryText` and resolve the best unlocked model for it. Never throws —
 * returns the Llama/general default on any error or empty input.
 */
export async function routeTask(
  queryText: string,
  plan: string | null | undefined,
): Promise<RouteResult> {
  const fallback: RouteResult = { category: 'general', modelId: LLAMA, webSearch: false };
  if (!queryText.trim() || !process.env.GROQ_API_KEY) return fallback;

  // Code-shaped prompts must never fall to the LLM classifier's 'general' bucket
  // (→ Llama). Route them straight to a code-capable model.
  if (/```|\bdef |\bfunction\b|\bimport |\bclass |=>|console\.|std::|public (static|class)/.test(queryText)) {
    return { category: 'code', modelId: pickModel('code', plan), webSearch: false };
  }

  try {
    // Bound the classifier: it runs BEFORE the main stream starts, so if Groq
    // hangs it would stall the entire chat (and eat into the function's time
    // budget). Cap it hard — a slow router must never block the answer; we just
    // fall back to the general/Llama default.
    const { text } = await Promise.race([
      generateText({
        model: groq('llama-3.1-8b-instant'),
        system: CLASSIFIER_SYSTEM,
        prompt: queryText.slice(0, 2000),
        maxTokens: 4,
        temperature: 0,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('classifier timeout')), 3500)),
    ]);
    const word = text.trim().toLowerCase().replace(/[^a-z]/g, '');
    const category: TaskCategory =
      (['writing', 'research', 'code', 'reasoning', 'general'] as const).includes(word as TaskCategory)
        ? (word as TaskCategory)
        : 'general';
    return { category, modelId: pickModel(category, plan), webSearch: category === 'research' };
  } catch {
    return fallback;
  }
}
