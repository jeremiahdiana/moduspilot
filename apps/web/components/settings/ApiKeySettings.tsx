'use client';

import { useState } from 'react';
import type { UserSettings, ModelConfig } from '@/hooks/useUserSettings';
import { canUseModel } from '@/lib/models';

interface Props {
  settings: UserSettings;
  plan: 'free' | 'modus' | 'pilot' | 'group';
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

const BYOK_PROVIDERS = [
  {
    id: 'openai' as const,
    name: 'OpenAI',
    description: 'Use your OpenAI API account with separate provider billing.',
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
    description: 'Use your Anthropic API account to power Modus with Claude.',
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

export default function ApiKeySettings({ settings, plan, saving, onSave }: Props) {
  const raw = settings.modelSettings;
  const rawProvider = raw?.provider ?? 'platform';
  const platformModel = rawProvider === 'platform' && raw?.model && (raw.model === 'auto' || raw.model === 'auto-saver' || canUseModel(raw.model, plan)) ? raw.model : 'auto';
  const [byokProvider, setByokProvider] = useState<'openai' | 'anthropic' | null>(
    ['openai', 'anthropic'].includes(rawProvider) ? (rawProvider as 'openai' | 'anthropic') : null
  );
  const [byokModel, setByokModel] = useState(raw?.model ?? '');
  const [openaiKey, setOpenaiKey] = useState(raw?.openaiKey ?? '');
  const [anthropicKey, setAnthropicKey] = useState(raw?.anthropicKey ?? '');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selectedByok = BYOK_PROVIDERS.find(p => p.id === byokProvider) ?? null;

  function toggleByok(key: 'openai' | 'anthropic') {
    if (byokProvider === key) {
      setByokProvider(null);
    } else {
      setByokProvider(key);
      const prov = BYOK_PROVIDERS.find(p => p.id === key)!;
      setByokModel(prov.models[0].id);
    }
    setSaved(false);
  }

  async function handleSave() {
    let modelSettings: ModelConfig;
    if (byokProvider && selectedByok) {
      modelSettings = { ...raw, provider: byokProvider, model: byokModel || selectedByok.models[0].id };
      if (byokProvider === 'openai' && openaiKey.trim()) modelSettings.openaiKey = openaiKey.trim();
      if (byokProvider === 'anthropic' && anthropicKey.trim()) modelSettings.anthropicKey = anthropicKey.trim();
    } else {
      modelSettings = { ...raw, provider: 'platform', model: platformModel };
    }
    setError('');
    try {
      await onSave({ modelSettings });
      setSaved(true);
    } catch { setError('Could not save your API settings. Please retry.'); }

  }

  const keyValue = byokProvider === 'openai' ? openaiKey : anthropicKey;
  const setKeyValue = byokProvider === 'openai' ? setOpenaiKey : setAnthropicKey;
  const canSave = !byokProvider || keyValue.trim().length > 10;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Personal API keys</h2>
        <p className="text-sm text-muted">Choose platform models in chat. Manage your own provider account here.</p>
      </div>

      {/* BYOK */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-text">Use your own API account</p>
          <p className="text-xs text-muted mt-0.5">Your key is used when the chat picker is set to Account default. Select a provider again to return to platform models.</p>
        </div>
        <div className="grid gap-2.5">
          {BYOK_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => toggleByok(p.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                byokProvider === p.id
                  ? 'border-brand/50 surface-tint ring-1 ring-brand/20'
                  : 'border-border bg-panel hover-border-tint'
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
                  byokModel === m.id ? 'border-brand/50 surface-tint' : 'border-border hover-border-tint'
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

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
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
          ) : 'Save API settings'}
        </button>
        {byokProvider && !keyValue.trim() && (
          <p className="text-xs text-muted">Add your API key to save.</p>
        )}
      </div>
    </div>
  );
}
