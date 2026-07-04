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
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3',      provider: 'Meta',      plans: ['free', 'modus', 'pilot'] },
  { id: 'gpt-4o',                  name: 'GPT-4o',         provider: 'OpenAI',    plans: ['modus', 'pilot'] },
  { id: 'claude-sonnet-4-6',       name: 'Claude Sonnet',  provider: 'Anthropic', plans: ['modus', 'pilot'] },
  { id: 'claude-opus-4-8',         name: 'Claude Opus',    provider: 'Anthropic', plans: ['pilot'] },
  { id: 'o4-mini',                 name: 'o4-mini',        provider: 'OpenAI',    plans: ['pilot'] },
  { id: 'gemini-2.5-pro',          name: 'Gemini 2.5 Pro', provider: 'Google',    plans: ['pilot'] },
  { id: 'grok-3',                  name: 'Grok 3',         provider: 'xAI',       plans: ['pilot'] },
];

export function effectivePlan(plan: string | null | undefined): string {
  return plan === 'group' ? 'pilot' : (plan ?? 'free');
}

export function modelName(id: string): string {
  return PLATFORM_MODELS.find(m => m.id === id)?.name ?? id;
}
