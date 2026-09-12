'use client';

import { useState, useEffect } from 'react';
import type { UserSettings, Preset } from '@/hooks/useUserSettings';

const newPresetId = () => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* noop */ }
  return `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
};

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
  return { value: i, label };
});

function getUTCHour(localHour: number): number {
  const d = new Date();
  d.setHours(localHour, 0, 0, 0);
  return d.getUTCHours();
}

function getLocalHourFromUTC(utcHour: number, timezone: string): number {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return parseInt(
    d.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }),
    10
  );
}

function getTZAbbr(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'short' }).split(' ').pop() ?? timezone;
  } catch {
    return timezone;
  }
}

const STYLES: Array<{ key: UserSettings['responseStyle']; label: string; desc: string }> = [
  { key: 'normal', label: 'Direct', desc: 'Straight to the answer. No softening or filler.' },
  { key: 'concise', label: 'Concise', desc: '1 to 3 sentences max. Zero elaboration.' },
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

  // Presets — reusable prompt directives, editable as a list and saved as a
  // whole array. Re-sync from settings whenever the store changes and we have no
  // unsaved edits (settings load async after mount).
  const [presets, setPresets] = useState<Preset[]>(settings.presets ?? []);
  const [presetsDirty, setPresetsDirty] = useState(false);
  useEffect(() => {
    if (!presetsDirty) setPresets(settings.presets ?? []);
  }, [settings.presets, presetsDirty]);

  const updatePreset = (id: string, field: 'label' | 'text', value: string) => {
    setPresets(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
    setPresetsDirty(true);
  };
  const addPreset = () => {
    setPresets(prev => [...prev, { id: newPresetId(), label: '', text: '' }]);
    setPresetsDirty(true);
  };
  const removePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
    setPresetsDirty(true);
  };
  const savePresets = async () => {
    const cleaned = presets
      .map(p => ({ id: p.id, label: p.label.trim(), text: p.text.trim() }))
      .filter(p => p.label && p.text);
    await onSave({ presets: cleaned });
    setPresets(cleaned);
    setPresetsDirty(false);
  };

  const [userTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });
  const [localBriefingHour, setLocalBriefingHour] = useState(() => {
    try {
      return getLocalHourFromUTC(settings.briefingHour ?? 7, userTimezone);
    } catch { return 7; }
  });
  const [localReflectionHour, setLocalReflectionHour] = useState(() => {
    try {
      return getLocalHourFromUTC(settings.reflectionHour ?? 21, userTimezone);
    } catch { return 21; }
  });

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
        <p className="text-sm text-muted">Personalize how Modus responds to you.</p>
      </div>

      {/* Personal context */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Personal Context</h3>
          <p className="text-xs text-muted">Tell Modus about yourself, your role, goals, how you like to work. This is included in every conversation.</p>
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

      {/* Presets — reusable prompt directives */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Presets</h3>
          <p className="text-xs text-muted">Reusable directives you can toggle on next to the model picker in chat (e.g. &quot;no em dashes&quot;, &quot;8th-grade diction&quot;). Only the ones you switch on are applied to a message.</p>
        </div>

        <div className="space-y-3">
          {presets.length === 0 && (
            <p className="text-xs text-muted/70">No presets yet. Add one below.</p>
          )}
          {presets.map(p => (
            <div key={p.id} className="bg-bg border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={p.label}
                  onChange={e => updatePreset(p.id, 'label', e.target.value)}
                  placeholder="Label (e.g. No em dashes)"
                  className="flex-1 min-w-0 bg-panel border border-border rounded-md px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
                />
                <button
                  onClick={() => removePreset(p.id)}
                  className="shrink-0 text-xs text-muted hover:text-red-400 px-2 py-1.5 transition-colors"
                  aria-label="Remove preset"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={p.text}
                onChange={e => updatePreset(p.id, 'text', e.target.value)}
                rows={2}
                placeholder="The instruction Modus follows, e.g. Do not use em dashes or Oxford commas anywhere."
                className="w-full bg-panel border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted/50 resize-none focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={addPreset}
            className="text-sm text-brand hover:text-brand/80 font-medium transition-colors"
          >
            + Add preset
          </button>
          <button
            onClick={savePresets}
            disabled={!presetsDirty || saving}
            className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save presets'}
          </button>
        </div>
      </div>

      {/* Daily briefing time */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Daily Briefing Time</h3>
          <p className="text-xs text-muted">Modus will drop your morning briefing into chat at this time every day.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={localBriefingHour}
            onChange={e => setLocalBriefingHour(Number(e.target.value))}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-brand/50 transition-colors"
          >
            {HOURS.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
          <span className="text-sm text-muted">{getTZAbbr(userTimezone)}</span>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => onSave({
              briefingHour: getUTCHour(localBriefingHour),
              briefingTimezone: userTimezone,
            })}
            disabled={saving}
            className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Evening reflection time */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text mb-1">Evening Reflection Time</h3>
          <p className="text-xs text-muted">Modus will send you an end-of-day recap at this time, what you shipped, what slipped, frame for tomorrow.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={localReflectionHour}
            onChange={e => setLocalReflectionHour(Number(e.target.value))}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-brand/50 transition-colors"
          >
            {HOURS.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
          <span className="text-sm text-muted">{getTZAbbr(userTimezone)}</span>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => onSave({ reflectionHour: getUTCHour(localReflectionHour), briefingTimezone: userTimezone })}
            disabled={saving}
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
          <p className="text-xs text-muted">Controls how Modus structures and tones its responses.</p>
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
