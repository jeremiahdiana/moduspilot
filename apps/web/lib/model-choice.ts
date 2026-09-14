import { canUseModel, canonicalModelId } from '@/lib/models';
import type { ModelConfig } from '@/hooks/useUserSettings';

export function resolveModelChoice(value: string | undefined, plan: string): string {
  if (!value) return 'auto';
  if (value === 'auto' || value === 'auto-saver' || value === 'default') return value;
  const model = canonicalModelId(value);
  return canUseModel(model, plan) ? model : 'auto';
}

export function accountModelChoice(config: ModelConfig | undefined, plan: string): string {
  if (config?.provider === 'openai' || config?.provider === 'anthropic') return 'default';
  return resolveModelChoice(config?.model, plan);
}
