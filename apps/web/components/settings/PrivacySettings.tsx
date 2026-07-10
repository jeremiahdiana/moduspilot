'use client';

import type { UserSettings } from '@/hooks/useUserSettings';

interface Props {
  settings: UserSettings;
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

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

export default function PrivacySettings({ settings, saving, onSave }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Privacy</h2>
        <p className="text-sm text-muted">Control how your data is used and stored.</p>
      </div>

      <div className="bg-panel border border-border rounded-xl divide-y divide-border">
        <div className="flex items-start justify-between p-6 gap-6">
          <div className="flex-1">
            <p className="text-sm font-medium text-text mb-1">Help Improve MODUS</p>
            <p className="text-xs text-muted leading-relaxed">Allow your conversations to be used to improve MODUS responses. Opting in extends data retention to 2 years. Opting out means conversations are deleted after 90 days.</p>
          </div>
          <Toggle
            checked={settings.helpImprove}
            onChange={v => onSave({ helpImprove: v })}
            disabled={saving}
          />
        </div>

        <div className="flex items-start justify-between p-6 gap-6">
          <div className="flex-1">
            <p className="text-sm font-medium text-text mb-1">Extended Data Retention</p>
            <p className="text-xs text-muted leading-relaxed">Keep your conversation history and memories for longer. When off, older data is automatically pruned after 90 days.</p>
          </div>
          <Toggle
            checked={settings.dataRetention}
            onChange={v => onSave({ dataRetention: v })}
            disabled={saving}
          />
        </div>
      </div>

      <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text">What We Store</h3>
        <ul className="space-y-2">
          {[
            'Your messages and AI responses (in Firestore)',
            'Goals, tasks, and habits you create',
            'Memories you save or that are auto-generated',
            'Account metadata (email, display name, plan)',
            'Daily message usage count (resets each day)',
          ].map(item => (
            <li key={item} className="flex items-start gap-2.5 text-xs text-muted">
              <span className="text-brand mt-0.5">◆</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text">Shared Links</h3>
        <p className="text-xs text-muted leading-relaxed">You can share any conversation as a read-only public link from the share button on a conversation in Chat. Anyone with the link can view that conversation until you revoke it — open the same menu and choose “Unshare” to revoke access at any time.</p>
      </div>
    </div>
  );
}
