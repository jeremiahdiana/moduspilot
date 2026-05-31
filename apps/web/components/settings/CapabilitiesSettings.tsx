'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import type { UserSettings } from '@/hooks/useUserSettings';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-brand' : 'bg-border'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

interface CapabilityRow {
  key: keyof UserSettings['capabilities'];
  label: string;
  desc: string;
  badge?: string;
}

const CAPABILITIES: CapabilityRow[] = [
  {
    key: 'webSearch',
    label: 'Web Search',
    desc: 'MODUS searches the web in real time when you ask external questions — news, prices, research, anything current.',
  },
  {
    key: 'dailyBriefing',
    label: 'Daily Briefing',
    desc: 'MODUS sends you a morning brief with your top priorities, pending approvals, and a quick check-in.',
  },
  {
    key: 'voiceInput',
    label: 'Voice Input',
    desc: 'Speak to MODUS instead of typing. Your audio is transcribed locally before being sent.',
    badge: 'Beta',
  },
  {
    key: 'vectorMemory',
    label: 'Vector Memory',
    desc: 'MODUS stores semantic memories from your conversations in Pinecone so it can recall past context across sessions.',
  },
  {
    key: 'inboxTriage',
    label: 'Inbox Triage',
    desc: 'MODUS watches your connected inbox and proactively drafts replies to emails waiting on you. Nothing sends until you approve, and you can edit any draft first.',
    badge: 'Beta',
  },
];

interface Props {
  settings: UserSettings;
  plan: 'free' | 'modus' | 'pilot';
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export default function CapabilitiesSettings({ settings, plan, saving, onSave }: Props) {
  const isPaid = plan === 'modus' || plan === 'pilot';
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleToggle = (key: keyof UserSettings['capabilities'], val: boolean) => {
    onSave({ capabilities: { ...settings.capabilities, [key]: val } });
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: 'modus' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Capabilities</h2>
        <p className="text-sm text-muted">Enable or disable advanced features.</p>
      </div>

      <div className="bg-panel border border-border rounded-xl divide-y divide-border">
        {CAPABILITIES.map(cap => {
          const isLocked = !isPaid && cap.badge !== 'Beta';
          return (
            <div key={cap.key} className="flex items-start justify-between p-6 gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-text">{cap.label}</p>
                  {cap.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      cap.badge === 'Beta' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-border text-muted'
                    }`}>
                      {cap.badge}
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/20 text-brand">MODUS+</span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">{cap.desc}</p>
              </div>
              <Toggle
                checked={settings.capabilities[cap.key]}
                onChange={v => handleToggle(cap.key, v)}
                disabled={saving || isLocked}
              />
            </div>
          );
        })}
      </div>

      {!isPaid && (
        <div className="bg-brand/10 border border-brand/30 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text mb-1">Unlock advanced capabilities</p>
            <p className="text-xs text-muted">Daily briefings and vector memory require MODUS or PILOT plan.</p>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="shrink-0 px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {upgradeLoading ? 'Redirecting…' : 'Upgrade'}
          </button>
        </div>
      )}
    </div>
  );
}
