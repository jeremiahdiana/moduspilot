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

export const PLATFORM_MODELS: ModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3',     provider: 'Meta',      plans: ['free', 'modus', 'pilot'] },
  { id: 'gpt-4o',                  name: 'GPT-4o',        provider: 'OpenAI',    plans: ['modus', 'pilot'] },
  { id: 'claude-sonnet-4-6',       name: 'Claude Sonnet', provider: 'Anthropic', plans: ['modus', 'pilot'] },
  { id: 'claude-opus-4-8',         name: 'Claude Opus',   provider: 'Anthropic', plans: ['pilot'] },
  { id: 'o4-mini',                 name: 'o4-mini',       provider: 'OpenAI',    plans: ['pilot'] },
  { id: 'gemini-2.5-pro',          name: 'Gemini 2.5 Pro', provider: 'Google',   plans: ['pilot'] },
  { id: 'grok-3',                  name: 'Grok 3',        provider: 'xAI',       plans: ['pilot'] },
];

/** Group members get PILOT-level model access — normalize so per-model `plans` match. */
export function effectivePlan(plan: string | null | undefined): string {
  return plan === 'group' ? 'pilot' : (plan ?? 'free');
}

export function isModelUnlocked(id: string, plan: string | null | undefined): boolean {
  const model = PLATFORM_MODELS.find(m => m.id === id);
  return !!model && model.plans.includes(effectivePlan(plan));
}

/** The models a given plan can use, in catalog order. */
export function unlockedModels(plan: string | null | undefined): ModelInfo[] {
  const ep = effectivePlan(plan);
  return PLATFORM_MODELS.filter(m => m.plans.includes(ep));
}

export function modelName(id: string): string {
  return PLATFORM_MODELS.find(m => m.id === id)?.name ?? id;
}
