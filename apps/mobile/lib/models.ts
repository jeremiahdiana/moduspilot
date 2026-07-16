// Mirror of apps/web/lib/models.ts — the selectable chat models ("Brains"),
// which plans unlock them, and plan-aware helpers for the in-chat model switcher.
// Keep in sync with the web catalog + resolveChatModel() on the server (which
// does the real provider routing). Auto routing itself runs server-side.

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  /** Plans that unlock this model. 'group' is normalized to 'pilot' access. */
  plans: string[];
}

export const PLATFORM_MODELS: ModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3',        provider: 'Meta',      plans: ['free', 'modus', 'pilot'] },
  { id: 'gpt-5.6-terra',           name: 'GPT-5.6 Terra',    provider: 'OpenAI',    plans: ['modus', 'pilot'] },
  { id: 'claude-sonnet-5',         name: 'Claude Sonnet 5',  provider: 'Anthropic', plans: ['modus', 'pilot'] },
  { id: 'gemini-3.5-flash',        name: 'Gemini 3.5 Flash', provider: 'Google',    plans: ['modus', 'pilot'] },
  { id: 'gpt-5.6-sol',             name: 'GPT-5.6 Sol',      provider: 'OpenAI',    plans: ['pilot'] },
  { id: 'claude-opus-4-8',         name: 'Claude Opus',      provider: 'Anthropic', plans: ['pilot'] },
  { id: 'gemini-3.1-pro-preview',  name: 'Gemini 3.1 Pro',   provider: 'Google',    plans: ['pilot'] },
  { id: 'claude-fable-5',          name: 'Claude Fable 5',   provider: 'Anthropic', plans: ['pilot'] },
  // Grok 4.5 withheld — xAI has no credits. Gemini 3.1 Pro restored 2026-07-17
  // once Google billing went live. See apps/web/lib/models.ts for the detail.
];

export function effectivePlan(plan: string | null | undefined): string {
  return plan === 'group' ? 'pilot' : (plan ?? 'free');
}

export function modelName(id: string): string {
  return PLATFORM_MODELS.find(m => m.id === id)?.name ?? id;
}
