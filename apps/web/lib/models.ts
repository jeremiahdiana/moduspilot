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
  // Served by the Vercel AI Gateway, NOT Groq. Groq decommissions its copy on
  // 2026-08-16 — but Llama is open-weight, so that only ever killed one host, not
  // the model. Same weights, so the switcher entry and every call site's token
  // budget are unchanged. See lib/chat/model.ts for why the Gateway beat Groq's
  // own suggested replacement (gpt-oss is a reasoner and returns '' at maxTokens 80).
  { id: 'meta/llama-3.3-70b',      name: 'Llama 3.3',        provider: 'Meta',      plans: ['free', 'modus', 'pilot'] },
  // ⚠️ Llama 4 Scout was added and REMOVED on 2026-07-17, hours apart. It answered
  // a live round-trip perfectly — and Groq's deprecation table lists its shutdown
  // date as 07/17/26, THE SAME DAY. Round-tripping proves a model serves NOW, not
  // that it serves TOMORROW: check the provider's deprecation page too.
  { id: 'gpt-5.6-terra',           name: 'GPT-5.6 Terra',    provider: 'OpenAI',    plans: ['modus', 'pilot'] },
  // Sonnet 5 supersedes Sonnet 4.6 at the SAME list price ($3/$15, and $2/$10
  // introductory through 2026-08-31) — a strictly better model for what we already
  // pay. Verified live 2026-07-17 through the real @ai-sdk/anthropic path.
  { id: 'claude-sonnet-5',         name: 'Claude Sonnet 5',  provider: 'Anthropic', plans: ['modus', 'pilot'] },
  { id: 'gemini-3.5-flash',        name: 'Gemini 3.5 Flash', provider: 'Google',    plans: ['modus', 'pilot'] },
  { id: 'gpt-5.6-sol',             name: 'GPT-5.6 Sol',      provider: 'OpenAI',    plans: ['pilot'] },
  { id: 'claude-opus-4-8',         name: 'Claude Opus',      provider: 'Anthropic', plans: ['pilot'] },
  // Restored 2026-07-17: Google billing is now live on the `modus-pilot` project
  // ($10 prepay), and this answers — verified with a real completion through
  // @ai-sdk/google, finish='stop', 1438 chars at the route's real 2048 cap. It was
  // withheld for exactly one day because a FREE-TIER key 429'd every Pro request.
  { id: 'gemini-3.1-pro-preview',  name: 'Gemini 3.1 Pro',   provider: 'Google',    plans: ['pilot'] },
  // Anthropic's most capable model — a real PILOT flagship, already covered by the
  // Anthropic account we pay for. ⚠️ $10/$50 per 1M, ~2x Opus 4.8: the priciest
  // thing we serve. Anthropic prompt caching (chat/route.ts) drops cached input to
  // ~$1/1M and is what keeps it viable at $59.
  { id: 'claude-fable-5',          name: 'Claude Fable 5',   provider: 'Anthropic', plans: ['pilot'] },

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
  // Sonnet 4.6 left the catalog for Sonnet 5 (same price, better model) on
  // 2026-07-17. Without this line every saved Brain holding the old id fails the
  // plan gate and silently drops that user to Llama — same tier, same provider,
  // so the successor is a clean swap.
  'claude-sonnet-4-6': 'claude-sonnet-5',
  // Llama moved OFF Groq onto the AI Gateway (Groq kills its copy 2026-08-16).
  // Same weights, new host, new id. These two lines are load-bearing: Firestore
  // stores settings.modelSettings.model as a RAW id with no backfill, so without
  // them every existing user whose saved Brain is Llama fails the plan gate and
  // gets silently dropped to... Llama, with the raw dead id showing in the
  // switcher. Same model, so the swap is exact.
  // ⚠️ THE LEFT SIDE MUST STAY THE GROQ ID. It is what Firestore already holds for
  // existing users; mapping it to itself makes the alias a no-op and drops every
  // one of them to a raw dead string in the switcher — the exact failure this map
  // exists to stop. A find-and-replace over model ids will silently "fix" it.
  'llama-3.3-70b-versatile': 'meta/llama-3.3-70b',
  'llama-3.1-8b-instant': 'meta/llama-3.1-8b',
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
 * "answered with meta/llama-3.1-8b instead" is not a sentence for a customer.
 */
const INTERNAL_MODELS: Record<string, { name: string; provider: string }> = {
  'meta/llama-3.1-8b': { name: 'Llama 3.1', provider: 'Meta' },
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
