import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PLATFORM_MODELS, effectivePlan } from '@/lib/models';
import { SMALL_TALK } from '@/lib/chat/context';

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
  writing:   ['claude-sonnet-4-6', 'claude-opus-4-8', 'gpt-5.6-terra'],
  // Up-to-date / factual digging. Grok led here for its real-time index and is
  // gone: xAI has no credits, so it could not answer at all (see lib/models.ts).
  // Gemini Flash takes the slot — it's the fastest model on MODUS and this is the
  // category that carries the web-search flag anyway.
  research:  ['gemini-3.5-flash', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
  // Code & math. Sol leads on PILOT and MODUS falls through to Terra, which is
  // what pickModel() is for. o4-mini is retired — 5.6 supersedes it.
  code:      ['gpt-5.6-sol', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
  // Hard multi-step reasoning / strategy.
  reasoning: ['gpt-5.6-sol', 'claude-opus-4-8', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
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
 * Confident-only regex routing. Returns null when unsure so the caller falls
 * through to the LLM classifier — these patterns must be high-precision, not
 * high-recall. Order matters: code is checked first because code questions
 * often also contain writing/reasoning verbs ("write a function", "solve this
 * bug"), and misrouting code to Llama is the worst outcome.
 */
function heuristicCategory(q: string): TaskCategory | null {
  // Code-shaped prompts must never fall to the classifier's 'general' bucket (→ Llama).
  if (/```|\bdef |\bfunction\b|\bimport |\bclass |=>|console\.|std::|public (static|class)/.test(q)) return 'code';
  const t = q.trim();
  // Greetings/acks and ultra-short asks are 'general' by definition — no round trip.
  if (SMALL_TALK.test(t) || t.split(/\s+/).length < 4) return 'general';
  if (/\b(debug|refactor|stack ?trace|compile|typescript|python|javascript|sql query|regex|api endpoint)\b/i.test(t)) return 'code';
  if (/\b(latest|news|current(ly)?|today'?s|price of|search for|look ?up|who won|stock|weather)\b/i.test(t)) return 'research';
  if (/\b(write|draft|rewrite|edit|essay|blog post|caption|copy|linkedin post|tweet|reply to)\b/i.test(t)) return 'writing';
  if (/\b(plan|strategy|prove|calculate|solve|trade-?offs?|step by step)\b/i.test(t)) return 'reasoning';
  return null;
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

  // ── Heuristic fast-path ────────────────────────────────────────────────────
  // The classifier is a network round trip that BLOCKS the stream (see below).
  // When a cheap regex is already confident, skip it entirely. Same idea as the
  // code-shaped check that was already here, widened to the other categories.
  // Anything ambiguous still falls through to the LLM classifier.
  const heuristic = heuristicCategory(queryText);
  if (heuristic) {
    console.log(`[route] heuristic=${heuristic}`);
    return { category: heuristic, modelId: pickModel(heuristic, plan), webSearch: heuristic === 'research' };
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
      // 1200ms, was 3500. llama-3.1-8b-instant with maxTokens:4 answers well
      // inside this; slower than that and the route was going to be stale anyway.
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('classifier timeout')), 1200)),
    ]);
    const word = text.trim().toLowerCase().replace(/[^a-z]/g, '');
    const category: TaskCategory =
      (['writing', 'research', 'code', 'reasoning', 'general'] as const).includes(word as TaskCategory)
        ? (word as TaskCategory)
        : 'general';
    console.log(`[route] llm=${category}`);
    return { category, modelId: pickModel(category, plan), webSearch: category === 'research' };
  } catch {
    return fallback;
  }
}
