'use client';

import type { UserSettings } from '@/hooks/useUserSettings';
import { DASHBOARD_WIDGETS, BRIEFING_SECTIONS } from '@/lib/layout-keys';
import { capabilityEnabled } from '@/lib/capabilities';

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
const SIDEBAR_GROUPS: { label: string; items: { key: string; label: string; locked?: boolean; hint?: string }[] }[] = [
  {
    label: 'Primary',
    items: [
      { key: 'chat', label: 'Chat', locked: true },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'projects', label: 'Projects' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { key: 'goals', label: 'Goals' },
      { key: 'reminders', label: 'Reminders' },
      { key: 'notes', label: 'Notes', hint: 'Shown when you have synced notes' },
      { key: 'group', label: 'Group', hint: "Shown when you're in a group" },
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

function Row({ label, hint, sublabel, checked, disabled, onChange }: {
  label: string; hint?: string; sublabel?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text">{label}</p>
          {sublabel && <span className="text-[10px] text-muted/60 uppercase tracking-wider">{sublabel}</span>}
        </div>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function DisplaySettings({ settings, saving, onSave }: Props) {
  const sidebarHidden = settings.sidebar?.hidden ?? [];
  const dashHidden = settings.layout?.dashboardHidden ?? [];
  const briefHidden = settings.layout?.briefingHidden ?? [];
  const briefingOn = capabilityEnabled(settings.capabilities, 'dailyBriefing');

  const setSidebar = (key: string, show: boolean) => {
    const next = show ? sidebarHidden.filter(k => k !== key) : Array.from(new Set([...sidebarHidden, key]));
    onSave({ sidebar: { hidden: next, workspaceCollapsed: settings.sidebar?.workspaceCollapsed ?? false } });
  };
  const setDash = (key: string, show: boolean) => {
    const next = show ? dashHidden.filter(k => k !== key) : Array.from(new Set([...dashHidden, key]));
    onSave({ layout: { dashboardHidden: next, briefingHidden: briefHidden } });
  };
  const setBrief = (key: string, show: boolean) => {
    const next = show ? briefHidden.filter(k => k !== key) : Array.from(new Set([...briefHidden, key]));
    onSave({ layout: { dashboardHidden: dashHidden, briefingHidden: next } });
  };
  const setBriefingMaster = (on: boolean) => {
    onSave({ capabilities: { ...settings.capabilities, dailyBriefing: on } as UserSettings['capabilities'] });
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Display</h2>
        <p className="text-sm text-muted">Choose what you see and where. Turn off anything you don&apos;t use — nothing is lost, and hidden sidebar items stay reachable with <kbd className="text-[10px] bg-panel border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>.</p>
      </div>

      {/* Sidebar */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Sidebar</h3>
          <p className="text-xs text-muted mt-0.5">Which destinations show in your navigation.</p>
        </div>
        {SIDEBAR_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">{group.label}</p>
            <div className="bg-panel border border-border rounded-xl divide-y divide-border">
              {group.items.map(item => (
                <Row
                  key={item.key}
                  label={item.label}
                  hint={item.hint}
                  sublabel={item.locked ? 'Always shown' : undefined}
                  checked={item.locked || !sidebarHidden.includes(item.key)}
                  disabled={saving || item.locked}
                  onChange={v => setSidebar(item.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Dashboard */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Dashboard</h3>
          <p className="text-xs text-muted mt-0.5">Which widgets appear on your dashboard.</p>
        </div>
        <div className="bg-panel border border-border rounded-xl divide-y divide-border">
          {DASHBOARD_WIDGETS.map(w => (
            <Row
              key={w.key}
              label={w.label}
              hint={w.hint}
              checked={!dashHidden.includes(w.key)}
              disabled={saving}
              onChange={v => setDash(w.key, v)}
            />
          ))}
        </div>
      </section>

      {/* Briefing */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Daily briefing</h3>
          <p className="text-xs text-muted mt-0.5">Your morning briefing and which cards it includes.</p>
        </div>
        <div className="bg-panel border border-border rounded-xl divide-y divide-border">
          <Row
            label="Daily briefing"
            hint="Generate and show your morning briefing"
            checked={briefingOn}
            disabled={saving}
            onChange={setBriefingMaster}
          />
        </div>
        <div className={briefingOn ? '' : 'opacity-50 pointer-events-none'}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">Briefing cards</p>
          <div className="bg-panel border border-border rounded-xl divide-y divide-border">
            {BRIEFING_SECTIONS.map(s => (
              <Row
                key={s.key}
                label={s.label}
                hint={s.hint}
                checked={!briefHidden.includes(s.key)}
                disabled={saving || !briefingOn}
                onChange={v => setBrief(s.key, v)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
