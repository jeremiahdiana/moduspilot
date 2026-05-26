'use client';

import { useState } from 'react';
import type { UserSettings } from '@/hooks/useUserSettings';

interface ModelConfig {
  provider: 'groq' | 'openai' | 'anthropic';
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
}

interface Props {
  settings: UserSettings;
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

const PROVIDERS = [
  {
    id: 'groq' as const,
    name: 'Modus',
    description: 'Included. Fast, free, always on.',
    badge: 'Included',
    badgeColor: 'bg-emerald-500/10 text-emerald-400',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', sub: 'Best quality' },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  sub: 'Fastest' },
    ],
    keyField: null,
    keyPlaceholder: '',
    docsUrl: '',
  },
  {
    id: 'openai' as const,
    name: 'OpenAI',
    description: 'Use your own API key to power MODUS with GPT-4o.',
    badge: 'BYOK',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o',      sub: 'Most capable' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', sub: 'Faster & cheaper' },
    ],
    keyField: 'openaiKey' as const,
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Use your own API key to power MODUS with Claude.',
    badge: 'BYOK',
    badgeColor: 'bg-violet-500/10 text-violet-400',
    models: [
      { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', sub: 'Best quality' },
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  sub: 'Fastest' },
    ],
    keyField: 'anthropicKey' as const,
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
];

export default function ModelSettings({ settings, saving, onSave }: Props) {
  const current: ModelConfig = (settings as unknown as { modelSettings?: ModelConfig }).modelSettings ?? {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  };

  const [provider, setProvider] = useState<ModelConfig['provider']>(current.provider ?? 'groq');
  const [model, setModel] = useState(current.model ?? 'llama-3.3-70b-versatile');
  const [openaiKey, setOpenaiKey] = useState(current.openaiKey ?? '');
  const [anthropicKey, setAnthropicKey] = useState(current.anthropicKey ?? '');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const selectedProvider = PROVIDERS.find(p => p.id === provider)!;

  function handleProviderSwitch(p: ModelConfig['provider']) {
    setProvider(p);
    const prov = PROVIDERS.find(x => x.id === p)!;
    setModel(prov.models[0].id);
    setSaved(false);
  }

  async function handleSave() {
    const modelSettings: ModelConfig = { provider, model };
    if (provider === 'openai' && openaiKey.trim()) modelSettings.openaiKey = openaiKey.trim();
    if (provider === 'anthropic' && anthropicKey.trim()) modelSettings.anthropicKey = anthropicKey.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await onSave({ modelSettings } as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const needsKey = provider !== 'groq';
  const keyValue = provider === 'openai' ? openaiKey : anthropicKey;
  const setKeyValue = provider === 'openai' ? setOpenaiKey : setAnthropicKey;
  const canSave = !needsKey || keyValue.trim().length > 10;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">AI Model</h2>
        <p className="text-sm text-muted">Choose which AI model powers MODUS. Bring your own API key to use GPT-4o or Claude.</p>
      </div>

      {/* Provider cards */}
      <div className="grid gap-3">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => handleProviderSwitch(p.id)}
            className={`text-left p-5 rounded-xl border transition-all ${
              provider === p.id
                ? 'border-brand/50 bg-brand/5 ring-1 ring-brand/20'
                : 'border-border bg-panel hover:border-brand/20'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-text">{p.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                  {current.provider === p.id && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">Active</span>
                  )}
                </div>
                <p className="text-xs text-muted">{p.description}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${
                provider === p.id ? 'border-brand bg-brand' : 'border-border'
              }`} />
            </div>
          </button>
        ))}
      </div>

      {/* Model picker */}
      <div className="bg-panel border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold text-text">Model</p>
        <div className="grid grid-cols-2 gap-2">
          {selectedProvider.models.map(m => (
            <button
              key={m.id}
              onClick={() => { setModel(m.id); setSaved(false); }}
              className={`text-left p-3 rounded-lg border transition-all ${
                model === m.id ? 'border-brand/50 bg-brand/5' : 'border-border hover:border-brand/20'
              }`}
            >
              <p className="text-sm font-medium text-text">{m.label}</p>
              <p className="text-xs text-muted">{m.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* API key input */}
      {needsKey && (
        <div className="bg-panel border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{selectedProvider.name} API Key</p>
            {selectedProvider.docsUrl && (
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:underline"
              >
                Get key →
              </a>
            )}
          </div>
          <p className="text-xs text-muted">Your key is stored privately in your account and only used to make requests on your behalf.</p>
          <div className="flex gap-2">
            <input
              type={showKey[provider] ? 'text' : 'password'}
              value={keyValue}
              onChange={e => { setKeyValue(e.target.value); setSaved(false); }}
              placeholder={selectedProvider.keyPlaceholder}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-muted/40 focus:outline-none focus:border-brand/50 transition-colors"
            />
            <button
              onClick={() => setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }))}
              className="px-3 text-xs text-muted border border-border rounded-lg hover:text-text transition-colors"
            >
              {showKey[provider] ? 'Hide' : 'Show'}
            </button>
          </div>
          {keyValue && !keyValue.startsWith(selectedProvider.keyPlaceholder.slice(0, 3)) && (
            <p className="text-xs text-amber-400">Key format looks unexpected — double-check it's the right key.</p>
          )}
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
          ) : 'Save Model Settings'}
        </button>
        {needsKey && !keyValue && (
          <p className="text-xs text-muted">Add your API key to save.</p>
        )}
      </div>
    </div>
  );
}
