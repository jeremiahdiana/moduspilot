'use client';

import { useState } from 'react';
import type { UserSettings } from '@/hooks/useUserSettings';

const STYLES: Array<{ key: UserSettings['responseStyle']; label: string; desc: string }> = [
  { key: 'normal', label: 'Direct', desc: 'Straight to the answer. No softening or filler.' },
  { key: 'concise', label: 'Concise', desc: '1–3 sentences max. Zero elaboration.' },
  { key: 'formal', label: 'Strategic', desc: 'Big-picture framing. Executive-level analysis.' },
  { key: 'learning', label: 'Coach', desc: 'Challenges assumptions. Holds you accountable.' },
  { key: 'explanatory', label: 'Supportive', desc: 'Warm and encouraging, never sycophantic.' },
  { key: 'custom', label: 'Custom', desc: 'Define your own style below.' },
];

interface Props {
  settings: UserSettings;
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export default function GeneralSettings({ settings, saving, onSave }: Props) {
  const [context, setContext] = useState(settings.personalContext);
  const [customStyle, setCustomStyle] = useState(settings.customStyle);
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    await onSave({
      personalContext: context,
      customStyle: settings.responseStyle === 'custom' ? customStyle : settings.customStyle,
    });
    setDirty(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">General</h2>
        <p className="text-sm text-muted">Personalize how MODUS responds to you.</p>
      </div>

      {/* Personal context */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Personal Context</h3>
          <p className="text-xs text-muted">Tell MODUS about yourself — your role, goals, how you like to work. This is included in every conversation.</p>
        </div>
        <textarea
          value={context}
          onChange={e => { setContext(e.target.value); setDirty(true); }}
          rows={5}
          placeholder="e.g. I'm a founder building a fitness marketplace. I prefer direct answers, bullet points, and no corporate fluff. I'm based in LA, work across product and marketing."
          className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text placeholder:text-muted/50 resize-none focus:outline-none focus:border-brand/50 transition-colors"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Response style */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Response Style</h3>
          <p className="text-xs text-muted">Controls how MODUS structures and tones its responses.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STYLES.map(s => (
            <button
              key={s.key}
              onClick={() => onSave({ responseStyle: s.key })}
              className={`text-left p-4 rounded-lg border transition-all ${
                settings.responseStyle === s.key
                  ? 'border-brand bg-brand/10 text-text'
                  : 'border-border hover:border-brand/40 text-muted hover:text-text'
              }`}
            >
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.desc}</p>
            </button>
          ))}
        </div>
        {settings.responseStyle === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Describe your preferred style or paste a writing sample:</p>
            <textarea
              value={customStyle}
              onChange={e => { setCustomStyle(e.target.value); setDirty(true); }}
              rows={4}
              placeholder="e.g. Use short paragraphs, be opinionated, avoid hedging language, write like a smart friend not a consultant."
              className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text placeholder:text-muted/50 resize-none focus:outline-none focus:border-brand/50 transition-colors"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Style'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
