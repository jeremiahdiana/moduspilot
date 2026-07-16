// Single source of truth for the selectable chat models ("Brains"), which plans
// unlock them, and the plan-aware helpers shared by the in-chat model switcher
// and the Auto router (lib/chat/auto-route.ts). Keep the ids in sync with
// resolveChatModel() in lib/chat/model.ts — that function does the actual
// provider routing + env-key gating.

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  /** Plans that unlock this model. 'group' is normalized to 'pilot' access. */
  plans: string[];
}

/**
 * MODUS gets every provider's everyday model; PILOT adds the frontier ones.
 *
 * Every id here was confirmed against the live provider API on 2026-07-16 — list
 * the models, then round-trip a real completion. That is not ceremony: a wrong id
 * does NOT error, it falls through to LLAMA_FALLBACK in lib/chat/model.ts and the
 * user is told a model answered that never ran. The docs are not a source of
 * truth either — "gemini-3.1-pro" is what Google's own release notes call it and
 * it 404s; the servable id is "gemini-3.1-pro-preview".
 */
export const PLATFORM_MODELS: ModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3',        provider: 'Meta',      plans: ['free', 'modus', 'pilot'] },
  // Groq-hosted, so FREE to serve. NOT a frontier model and must never be sold as
  // one — and NOT an upgrade on Llama 3.3 either: verified 2026-07-17, Llama 3.3
  // beats it on MMLU (86.0 vs 79.6), math and code, while Scout wins on context
  // (~2.5x), speed, GPQA and MMLU-Pro. It is a TRADE, so the switcher copy says
  // exactly that and Auto is deliberately NOT pointed at it.
  // Its multimodality is unreachable here: resolveChatModel's vision path sends any
  // model + image to gpt-4o-mini before the prefix chain, so never claim it reads
  // images. Routing lives in GROQ_HOSTED (lib/chat/model.ts): this id matches no
  // provider prefix, so without that entry it is served by Llama SILENTLY.
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', provider: 'Meta', plans: ['modus', 'pilot'] },
  { id: 'gpt-5.6-terra',           name: 'GPT-5.6 Terra',    provider: 'OpenAI',    plans: ['modus', 'pilot'] },
  { id: 'claude-sonnet-4-6',       name: 'Claude Sonnet',    provider: 'Anthropic', plans: ['modus', 'pilot'] },
  { id: 'gemini-3.5-flash',        name: 'Gemini 3.5 Flash', provider: 'Google',    plans: ['modus', 'pilot'] },
  { id: 'gpt-5.6-sol',             name: 'GPT-5.6 Sol',      provider: 'OpenAI',    plans: ['pilot'] },
  { id: 'claude-opus-4-8',         name: 'Claude Opus',      provider: 'Anthropic', plans: ['pilot'] },

  // ── Withheld until the provider account can actually serve them ──────────────
  // Both were live on PILOT and NEITHER could answer a single request, which the
  // failover chain hid: Google's 429 body contains "429"/"quota", isFailoverError
  // matches it, and the request is silently retried on Llama — "the switch is
  // invisible to the user". So $59 customers picked Gemini and were answered by
  // Llama with no error. Listing a model we cannot serve is the bug; the fix is
  // billing, not code.
  //
  // Verified 2026-07-16 with the production keys:
  //   gemini-3.1-pro-preview → 429 "You exceeded your current quota, please check
  //                                 your plan and billing details" (free-tier key)
  //   grok-4.5               → 403 "Your newly created team doesn't have any
  //                                 credits or licenses yet"
  //
  // To restore: enable billing on the Google AI Studio key / buy xAI credits,
  // re-run the round-trip check, then uncomment. The ids below are verified-real
  // (they resolve; they are only quota/credit blocked) so nothing else changes.
  // { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', plans: ['pilot'] },
  // { id: 'grok-4.5',               name: 'Grok 4.5',       provider: 'xAI',    plans: ['pilot'] },
];

/**
 * Retired id → the successor a user should land on. Saved Brains store a raw id
 * (Firestore settings.modelSettings.model) and there is no backfill, so an id
 * that leaves the catalog would drop that user to Llama and show them the raw
 * string in the switcher. Resolved on read via canonicalModelId().
 *
 * grok-3 and gemini-2.5-pro map ACROSS providers on purpose: they cannot be
 * served at all right now, so anyone holding them is already getting Llama or an
 * error. A working model of the same tier is strictly better than that.
 */
const LEGACY_MODEL_IDS: Record<string, string> = {
  'gpt-4o': 'gpt-5.6-terra',          // May 2024; superseded and now cheaper to beat
  'o4-mini': 'gpt-5.6-sol',           // o-series reasoning → the 5.6 flagship
  'gemini-2.5-pro': 'gemini-3.5-flash', // retires 2026-10-16, and 429s today
  'grok-3': 'gpt-5.6-sol',            // xAI has no credits; keep them on a frontier model
};

/** Map a stored/legacy model id onto the catalog id that should actually serve it. */
export function canonicalModelId(id: string): string {
  return LEGACY_MODEL_IDS[id] ?? id;
}

/** Group members get PILOT-level model access — normalize so per-model `plans` match. */
export function effectivePlan(plan: string | null | undefined): string {
  return plan === 'group' ? 'pilot' : (plan ?? 'free');
}

export function isModelUnlocked(id: string, plan: string | null | undefined): boolean {
  const model = PLATFORM_MODELS.find(m => m.id === canonicalModelId(id));
  return !!model && model.plans.includes(effectivePlan(plan));
}

/** The models a given plan can use, in catalog order. */
export function unlockedModels(plan: string | null | undefined): ModelInfo[] {
  const ep = effectivePlan(plan);
  return PLATFORM_MODELS.filter(m => m.plans.includes(ep));
}

/**
 * Display names for models that answer but are NOT selectable Brains: the failover
 * safety net in lib/chat/model.ts (chatFallbackChain). They are deliberately kept
 * out of PLATFORM_MODELS — that list is the switcher AND the tier gate, so adding
 * them would offer them for sale. They still need a human name, because when the
 * chain switches we now tell the user who actually answered, and
 * "answered with llama-3.1-8b-instant instead" is not a sentence for a customer.
 */
const INTERNAL_MODELS: Record<string, { name: string; provider: string }> = {
  'llama-3.1-8b-instant': { name: 'Llama 3.1', provider: 'Meta' },
  'gpt-4o-mini':          { name: 'GPT-4o mini', provider: 'OpenAI' },
};

/**
 * The provider that owns a model id, for display (logos). Covers the internal
 * fallback models too, so a chip naming the model that really answered can still
 * show its mark — PLATFORM_MODELS alone would return undefined and drop the logo.
 */
export function modelProvider(id: string): string {
  const canonical = canonicalModelId(id);
  return PLATFORM_MODELS.find(m => m.id === canonical)?.provider
    ?? INTERNAL_MODELS[canonical]?.provider
    ?? '';
}

export function modelName(id: string): string {
  const canonical = canonicalModelId(id);
  return PLATFORM_MODELS.find(m => m.id === canonical)?.name
    ?? INTERNAL_MODELS[canonical]?.name
    ?? id;
}
