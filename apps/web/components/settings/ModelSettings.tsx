'use client';

import { useState } from 'react';
import type { UserSettings, ModelConfig } from '@/hooks/useUserSettings';
import { isPaidPlan, isPilotLevelPlan } from '@/lib/plan';
import { ProviderLogo } from '@/components/marketing/BrandLogos';

interface Props {
  settings: UserSettings;
  plan: 'free' | 'modus' | 'pilot' | 'group';
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

const BRAINS = [
  {
    id: 'auto',
    name: 'Auto',
    provider: 'MODUS routing',
    tagline: 'Best model for every task',
    description: "MODUS reads each message and routes it to the model that'll do it best — Claude for nuanced writing and analysis, a reasoning model for code and math, real-time models for research, and fast Llama for everyday chat. One Brain, every model. Auto only routes to the models your plan unlocks.",
    badge: 'Recommended',
    badgeColor: 'bg-brand text-white',
    plans: ['free', 'modus', 'pilot'] as string[],
  },
  {
    id: 'meta/llama-3.3-70b',
    name: 'Llama 3.3',
    provider: 'Meta',
    tagline: 'Fast & always available',
    description: 'Great for everyday tasks, brainstorming, and writing. Zero latency.',
    badge: 'Free',
    badgeColor: 'bg-emerald-500/10 text-emerald-400',
    plans: ['free', 'modus', 'pilot'] as string[],
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'Google',
    tagline: 'Fast, multimodal, free',
    description: "Google's lightweight model. Quick, vision-capable, and available on every plan.",
    badge: 'Free',
    badgeColor: 'bg-emerald-500/10 text-emerald-400',
    plans: ['free', 'modus', 'pilot'] as string[],
  },
  {
    id: 'deepseek/deepseek-v3.1',
    name: 'DeepSeek V3.1',
    provider: 'DeepSeek',
    tagline: 'Strong open reasoning',
    description: "DeepSeek's V3.1, a capable open model for reasoning, code, and analysis.",
    badge: 'MODUS+',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'] as string[],
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    provider: 'OpenAI',
    tagline: 'Balanced & reliable',
    description: "OpenAI's balanced everyday model. Handles text, images, and complex reasoning.",
    badge: 'MODUS+',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'] as string[],
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    tagline: 'Exceptional writing & analysis',
    description: 'Best for nuanced writing, editing, and thorough analysis. Low hallucination rate.',
    badge: 'MODUS+',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'] as string[],
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'Google',
    tagline: 'Fast & multimodal',
    description: "Google's fastest current model, strong on agentic and coding work, with a huge context window.",
    badge: 'MODUS+',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    plans: ['modus', 'pilot'] as string[],
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    provider: 'OpenAI',
    tagline: 'Deepest reasoning',
    description: "OpenAI's flagship. For the hardest problems — long-horizon reasoning, coding, and science.",
    badge: 'PILOT',
    badgeColor: 'bg-brand/10 text-brand',
    plans: ['pilot'] as string[],
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus',
    provider: 'Anthropic',
    // NOT "most capable" any more — Fable 5 is, and it's right below. Two models
    // in one list can't both claim the top; the user can read them side by side.
    tagline: 'Deep reasoning, faster',
    description: 'Highly capable and quicker to answer than Fable 5. The right pick for hard work that still needs to come back promptly.',
    badge: 'PILOT',
    badgeColor: 'bg-brand/10 text-brand',
    plans: ['pilot'] as string[],
  },
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'Anthropic',
    tagline: "Anthropic's most capable",
    description: 'The strongest model MODUS can run, for the hardest reasoning and long, multi-step work. Thinks longer, so it answers slower.',
    badge: 'PILOT',
    badgeColor: 'bg-brand/10 text-brand',
    plans: ['pilot'] as string[],
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    tagline: 'Google’s frontier model',
    description: "Google's most capable model. Strong on long-context reasoning, research, and code.",
    badge: 'PILOT',
    badgeColor: 'bg-brand/10 text-brand',
    plans: ['pilot'] as string[],
  },
  {
    id: 'meta/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    tagline: 'Fast multimodal open model',
    description: "Meta's Llama 4 Maverick. Multimodal and quick, for everyday work on PILOT.",
    badge: 'PILOT',
    badgeColor: 'bg-brand/10 text-brand',
    plans: ['pilot'] as string[],
  },
  // Grok 4.5 is withheld until xAI has credits (Gemini 3.1 Pro was restored
  // 2026-07-17 when Google billing went live) — see the note in lib/models.ts.
  // Keep this list matching that catalog (PLATFORM_MODELS): a Brain offered here
  // that PLATFORM_MODELS doesn't unlock is a lock badge the user can never earn,
  // and a catalog model missing here can't be set as a default Brain.
];

const BYOK_PROVIDERS = [
  {
    id: 'openai' as const,
    name: 'OpenAI',
    description: 'Use your own OpenAI subscription — full control over usage and billing.',
    badge: 'Your key',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o',      sub: 'Most capable' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Faster & lighter' },
    ],
    keyField: 'openaiKey' as const,
    keyPlaceholder: 'sk-proj-…',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Use your own Anthropic subscription to power MODUS with Claude.',
    badge: 'Your key',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    models: [
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', sub: 'Best quality' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  sub: 'Fastest' },
    ],
    keyField: 'anthropicKey' as const,
    keyPlaceholder: 'sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
];

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
      selected ? 'border-brand bg-brand' : 'border-border'
    }`} />
  );
}

export default function ModelSettings({ settings, plan, saving, onSave }: Props) {
  const raw = settings.modelSettings;
  const rawProvider = raw?.provider ?? 'platform';
  const isPaid = isPaidPlan(plan);
  const isPilot = isPilotLevelPlan(plan);
  // Group gets PILOT-level model access — normalize so the per-model `plans`
  // arrays (which list 'modus'/'pilot') unlock the right models for group.
  const effectivePlan = plan === 'group' ? 'pilot' : plan;

  const initialPlatformModel = (() => {
    if (!raw?.model || rawProvider !== 'platform') return 'auto';
    const brain = BRAINS.find(b => b.id === raw.model);
    if (!brain) return 'auto';
    if (!brain.plans.includes(effectivePlan)) return 'auto';
    return raw.model;
  })();

  const [platformModel, setPlatformModel] = useState(initialPlatformModel);
  const [byokProvider, setByokProvider] = useState<'openai' | 'anthropic' | null>(
    ['openai', 'anthropic'].includes(rawProvider) ? (rawProvider as 'openai' | 'anthropic') : null
  );
  const [byokModel, setByokModel] = useState(raw?.model ?? '');
  const [openaiKey, setOpenaiKey] = useState(raw?.openaiKey ?? '');
  const [anthropicKey, setAnthropicKey] = useState(raw?.anthropicKey ?? '');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const selectedByok = BYOK_PROVIDERS.find(p => p.id === byokProvider) ?? null;

  function selectBrain(id: string) {
    const brain = BRAINS.find(b => b.id === id)!;
    if (!brain.plans.includes(effectivePlan)) return;
    setPlatformModel(id);
    setByokProvider(null);
    setSaved(false);
  }

  function toggleByok(key: 'openai' | 'anthropic') {
    if (byokProvider === key) {
      setByokProvider(null);
    } else {
      setByokProvider(key);
      const prov = BYOK_PROVIDERS.find(p => p.id === key)!;
      setByokModel(prev => prev || prov.models[0].id);
    }
    setSaved(false);
  }

  async function handleSave() {
    let modelSettings: ModelConfig;
    if (byokProvider && selectedByok) {
      modelSettings = { provider: byokProvider, model: byokModel || selectedByok.models[0].id };
      if (byokProvider === 'openai' && openaiKey.trim()) modelSettings.openaiKey = openaiKey.trim();
      if (byokProvider === 'anthropic' && anthropicKey.trim()) modelSettings.anthropicKey = anthropicKey.trim();
    } else {
      modelSettings = { provider: 'platform', model: platformModel };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await onSave({ modelSettings } as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const keyValue = byokProvider === 'openai' ? openaiKey : anthropicKey;
  const setKeyValue = byokProvider === 'openai' ? setOpenaiKey : setAnthropicKey;
  const canSave = !byokProvider || keyValue.trim().length > 10;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Your Brain</h2>
        <p className="text-sm text-muted">Choose the AI that powers MODUS. Your memory, inbox triage, and integrations stay consistent no matter which Brain you pick.</p>
      </div>

      {/* Platform Brains */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text">Platform Brains</p>
        <div className="grid gap-2.5">
          {BRAINS.map(brain => {
            const locked = !brain.plans.includes(effectivePlan);
            const isSelected = !byokProvider && platformModel === brain.id;
            return (
              <button
                key={brain.id}
                onClick={() => selectBrain(brain.id)}
                disabled={locked}
                className={`text-left p-4 rounded-xl border transition-all ${
                  locked
                    ? 'border-border bg-panel opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
                    : 'border-border bg-panel hover:border-brand/20 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="shrink-0 w-9 h-9 rounded-lg bg-bg border border-border flex items-center justify-center text-text/80">
                      <ProviderLogo provider={brain.provider} className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-sm font-semibold ${isSelected ? 'text-brand' : 'text-text'}`}>{brain.name}</span>
                      <span className="text-xs text-muted">{brain.provider}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${brain.badgeColor}`}>{brain.badge}</span>
                      {locked && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/10 text-muted">
                          {brain.badge === 'PILOT' ? 'PILOT only' : 'Locked'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-text/70 mb-0.5">{brain.tagline}</p>
                    <p className="text-xs text-muted leading-relaxed">{brain.description}</p>
                    </div>
                  </div>
                  {!locked && <RadioDot selected={isSelected} />}
                </div>
              </button>
            );
          })}
        </div>

        {!isPaid && (
          <p className="text-xs text-muted text-center pt-1">
            <span className="text-brand font-medium">Upgrade to MODUS</span> to unlock GPT-5.6, Claude Sonnet 5 and Gemini.{' '}
            <span className="text-brand font-medium">PILOT</span> adds the frontier models.
          </p>
        )}
        {isPaid && !isPilot && (
          <p className="text-xs text-muted text-center pt-1">
            <span className="text-brand font-medium">Upgrade to PILOT</span> to unlock GPT-5.6 Sol, Claude Opus, Claude Fable 5 and Gemini 3.1 Pro.
          </p>
        )}
      </div>

      {/* BYOK */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-text">Use your own subscription</p>
          <p className="text-xs text-muted mt-0.5">Have your own OpenAI or Anthropic key? It overrides your platform Brain.</p>
        </div>
        <div className="grid gap-2.5">
          {BYOK_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => toggleByok(p.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                byokProvider === p.id
                  ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
                  : 'border-border bg-panel hover:border-brand/20'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-semibold ${byokProvider === p.id ? 'text-brand' : 'text-text'}`}>{p.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                  </div>
                  <p className="text-xs text-muted">{p.description}</p>
                </div>
                <RadioDot selected={byokProvider === p.id} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BYOK model picker */}
      {byokProvider && selectedByok && (
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-text">Model</p>
          <div className="grid grid-cols-2 gap-2">
            {selectedByok.models.map(m => (
              <button
                key={m.id}
                onClick={() => { setByokModel(m.id); setSaved(false); }}
                className={`text-left p-3 rounded-lg border transition-all ${
                  byokModel === m.id ? 'border-brand/50 bg-brand/5' : 'border-border hover:border-brand/20'
                }`}
              >
                <p className="text-sm font-medium text-text">{m.label}</p>
                <p className="text-xs text-muted mt-0.5">{m.sub}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BYOK key input */}
      {byokProvider && selectedByok && (
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{selectedByok.name} API Key</p>
            {selectedByok.docsUrl && (
              <a href={selectedByok.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                Get key →
              </a>
            )}
          </div>
          <p className="text-xs text-muted">Stored privately on your account. Only used to make requests on your behalf.</p>
          <div className="flex gap-2">
            <input
              type={showKey[byokProvider] ? 'text' : 'password'}
              value={keyValue}
              onChange={e => { setKeyValue(e.target.value); setSaved(false); }}
              placeholder={selectedByok.keyPlaceholder}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-muted/40 focus:outline-none focus:border-brand/50 transition-colors"
            />
            <button
              onClick={() => setShowKey(prev => ({ ...prev, [byokProvider]: !prev[byokProvider] }))}
              className="px-3 text-xs text-muted border border-border rounded-lg hover:text-text transition-colors"
            >
              {showKey[byokProvider] ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </span>
          ) : 'Save Brain'}
        </button>
        {byokProvider && !keyValue.trim() && (
          <p className="text-xs text-muted">Add your API key to save.</p>
        )}
      </div>
    </div>
  );
}
