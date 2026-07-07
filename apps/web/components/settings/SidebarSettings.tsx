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
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${checked ? 'bg-brand' : 'bg-border'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// Mirrors the sidebar groups in app/(dashboard)/layout.tsx.
// `locked` items (Chat, Settings) are always shown and can't be hidden.
const GROUPS: { label: string; items: { key: string; label: string; locked?: boolean }[] }[] = [
  {
    label: 'Primary',
    items: [
      { key: 'chat', label: 'Chat', locked: true },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'briefing', label: 'Briefing' },
      { key: 'projects', label: 'Projects' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { key: 'goals', label: 'Goals' },
      { key: 'reminders', label: 'Reminders' },
      { key: 'notes', label: 'Notes' },
      { key: 'group', label: 'Group' },
    ],
  },
  {
    label: 'More',
    items: [
      { key: 'capabilities', label: 'Capabilities' },
      { key: 'settings', label: 'Settings', locked: true },
    ],
  },
];

export default function SidebarSettings({ settings, saving, onSave }: Props) {
  const hidden = settings.sidebar?.hidden ?? [];

  const setVisible = (key: string, show: boolean) => {
    const next = show
      ? hidden.filter(k => k !== key)
      : Array.from(new Set([...hidden, key]));
    onSave({ sidebar: { hidden: next, workspaceCollapsed: settings.sidebar?.workspaceCollapsed ?? false } });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Sidebar</h2>
        <p className="text-sm text-muted">Choose which destinations show in your sidebar. Hidden ones are still reachable anytime with <kbd className="text-[10px] bg-panel border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>.</p>
      </div>

      {GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">{group.label}</p>
          <div className="bg-panel border border-border rounded-xl divide-y divide-border">
            {group.items.map(item => {
              const checked = item.locked || !hidden.includes(item.key);
              return (
                <div key={item.key} className="flex items-center justify-between p-4 gap-6">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    {item.locked && <span className="text-[10px] text-muted/60 uppercase tracking-wider">Always shown</span>}
                  </div>
                  <Toggle
                    checked={checked}
                    onChange={v => setVisible(item.key, v)}
                    disabled={saving || item.locked}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
