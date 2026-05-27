'use client';

import { useState } from 'react';
import type { UserSettings } from '@/hooks/useUserSettings';

interface ModelConfig {
  provider: 'platform' | 'openai' | 'anthropic';
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
}

interface Props {
  settings: UserSettings;
  plan: 'free' | 'modus' | 'pilot';
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

const PLATFORM_MODELS = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'MODUS',
    tagline: 'Fast & Creative',
    description: 'Great for brainstorming, writing, and everyday tasks. Instant responses.',
    badge: 'Default',
    badgeColor: 'bg-brand/10 text-brand',
  },
  {
    id: 'gpt-5-mini',
    name: 'MODUS 2.0',
    tagline: 'Smarter & More Capable',
    description: 'Deeper reasoning, sharper analysis, and more nuanced responses for complex work.',
    badge: 'Pro',
    badgeColor: 'bg-violet-500/10 text-violet-400',
  },
];

const BYOK_PROVIDERS = [
  {
    id: 'openai' as const,
    name: 'OpenAI',
    description: 'Use your own OpenAI API key for full control over usage and billing.',
    badge: 'BYOK',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o',      sub: 'Most capable' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Faster & cheaper' },
    ],
    keyField: 'openaiKey' as const,
    keyPlaceholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Use your own Anthropic API key to power MODUS with Claude.',
    badge: 'BYOK',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    models: [
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', sub: 'Best quality' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  sub: 'Fastest' },
    ],
    keyField: 'anthropicKey' as const,
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
];

export default function ModelSettings({ settings, plan, saving, onSave }: Props) {
  const raw = (settings as unknown as { modelSettings?: ModelConfig }).modelSettings;
  const rawProvider = raw?.provider ?? 'platform';
  const isPaid = plan === 'modus' || plan === 'pilot';

  // Platform model selection (only applies when provider === 'platform')
  const [platformModel, setPlatformModel] = useState(
    raw?.model && !raw.model.startsWith('gpt') && !raw.model.startsWith('claude')
      ? raw.model
      : raw?.model === 'gpt-5-mini' ? 'gpt-5-mini' : 'llama-3.3-70b-versatile'
  );

  // BYOK state
  const byokProviders = BYOK_PROVIDERS.map(p => p.id) as string[];
  const isByok = byokProviders.includes(rawProvider);
  const [byokProvider, setByokProvider] = useState<'openai' | 'anthropic' | null>(
    isByok ? (rawProvider as 'openai' | 'anthropic') : null
  );
  const [byokModel, setByokModel] = useState(raw?.model ?? '');
  const [openaiKey, setOpenaiKey] = useState(raw?.openaiKey ?? '');
  const [anthropicKey, setAnthropicKey] = useState(raw?.anthropicKey ?? '');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const selectedByok = BYOK_PROVIDERS.find(p => p.id === byokProvider) ?? null;

  function handlePlatformModelSelect(modelId: string) {
    if (!isPaid) return;
    setPlatformModel(modelId);
    setByokProvider(null);
    setSaved(false);
  }

  function handleByokSelect(p: 'openai' | 'anthropic') {
    setByokProvider(prev => prev === p ? null : p);
    const prov = BYOK_PROVIDERS.find(x => x.id === p)!;
    setByokModel(prov.models[0].id);
    setSaved(false);
  }

  async function handleSave() {
    let modelSettings: ModelConfig;
    if (byokProvider && selectedByok) {
      modelSettings = { provider: byokProvider, model: byokModel };
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

  const needsKey = !!byokProvider;
  const keyValue = byokProvider === 'openai' ? openaiKey : anthropicKey;
  const setKeyValue = byokProvider === 'openai' ? setOpenaiKey : setAnthropicKey;
  const canSave = !needsKey || keyValue.trim().length > 10;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">AI Model</h2>
        <p className="text-sm text-muted">Choose which AI powers your MODUS.</p>
      </div>

      {/* Platform model selector */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text">MODUS Models</p>
        <div className="grid gap-3">
          {PLATFORM_MODELS.map(m => {
            const isSelected = !byokProvider && platformModel === m.id;
            const locked = !isPaid;
            return (
              <button
                key={m.id}
                onClick={() => handlePlatformModelSelect(m.id)}
                disabled={locked}
                className={`text-left p-5 rounded-xl border transition-all ${
                  locked
                    ? 'border-border bg-panel opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
                    : 'border-border bg-panel hover:border-brand/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-text">{m.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.badgeColor}`}>{m.badge}</span>
                      {locked && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/10 text-muted">
                          🔒 Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-text/70 mb-0.5">{m.tagline}</p>
                    <p className="text-xs text-muted">{m.description}</p>
                  </div>
                  {!locked && (
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${
                      isSelected ? 'border-brand bg-brand' : 'border-border'
                    }`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Free user upgrade CTA */}
        {!isPaid && (
          <p className="text-xs text-muted text-center pt-1">
            Best for productivity —{' '}
            <span className="text-brand font-medium">upgrade to MODUS</span>
            {' '}to unlock model selection.
          </p>
        )}
      </div>

      {/* BYOK section */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text">Bring Your Own Key</p>
        <div className="grid gap-3">
          {BYOK_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handleByokSelect(p.id)}
              className={`text-left p-5 rounded-xl border transition-all ${
                byokProvider === p.id
                  ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
                  : 'border-border bg-panel hover:border-brand/20'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text">{p.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                  </div>
                  <p className="text-xs text-muted">{p.description}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${
                  byokProvider === p.id ? 'border-brand bg-brand' : 'border-border'
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BYOK model picker */}
      {byokProvider && selectedByok && (
        <div className="bg-panel border border-border rounded-xl p-5 space-y-3">
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
                <p className="text-xs text-muted">{m.sub}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BYOK API key input */}
      {needsKey && selectedByok && (
        <div className="bg-panel border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{selectedByok.name} API Key</p>
            {selectedByok.docsUrl && (
              <a href={selectedByok.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                Get key →
              </a>
            )}
          </div>
          <p className="text-xs text-muted">Stored privately in your account, only used to make requests on your behalf.</p>
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
          disabled={saving || !canSave || !isPaid}
          className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </span>
          ) : 'Save Model Settings'}
        </button>
        {needsKey && !keyValue && (
          <p className="text-xs text-muted">Add your API key to save.</p>
        )}
      </div>
    </div>
  );
}
