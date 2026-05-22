'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import GeneralSettings from '@/components/settings/GeneralSettings';
import AccountSettings from '@/components/settings/AccountSettings';
import PrivacySettings from '@/components/settings/PrivacySettings';
import BillingSettings from '@/components/settings/BillingSettings';
import UsageSettings from '@/components/settings/UsageSettings';
import CapabilitiesSettings from '@/components/settings/CapabilitiesSettings';
import ConnectorsSettings from '@/components/settings/ConnectorsSettings';
import MemorySettings from '@/components/settings/MemorySettings';

function TabIcon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

const TABS = [
  { key: 'general',      label: 'General',      icon: <TabIcon d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /> },
  { key: 'account',      label: 'Account',      icon: <TabIcon d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" d2="M12 3a4 4 0 110 8 4 4 0 010-8z" /> },
  { key: 'privacy',      label: 'Privacy',      icon: <TabIcon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  { key: 'billing',      label: 'Billing',      icon: <TabIcon d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22" /> },
  { key: 'usage',        label: 'Usage',        icon: <TabIcon d="M18 20V10M12 20V4M6 20v-6" /> },
  { key: 'capabilities', label: 'Capabilities', icon: <TabIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
  { key: 'connectors',   label: 'Connectors',   icon: <TabIcon d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" d2="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /> },
  { key: 'memory',       label: 'Memory',       icon: <TabIcon d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v4l3 3" /> },
] as const;

type Tab = typeof TABS[number]['key'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { settings, memories, plan, usage, loading, saving, saveSettings, addMemory, deleteMemory } = useUserSettings(user);

  const activeTab = (searchParams.get('tab') ?? 'general') as Tab;

  const setTab = (tab: Tab) => {
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted text-sm">Sign in to manage settings.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r border-border py-6 px-3 flex flex-col">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider px-3 mb-3">Settings</p>
        <nav className="flex flex-col gap-0.5 flex-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="pt-4 border-t border-border">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-panel transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto py-8 px-8">
        <div className="max-w-2xl">
          {activeTab === 'general' && (
            <GeneralSettings settings={settings} saving={saving} onSave={saveSettings} />
          )}
          {activeTab === 'account' && (
            <AccountSettings user={user} />
          )}
          {activeTab === 'privacy' && (
            <PrivacySettings settings={settings} saving={saving} onSave={saveSettings} />
          )}
          {activeTab === 'billing' && (
            <BillingSettings plan={plan} />
          )}
          {activeTab === 'usage' && (
            <UsageSettings plan={plan} usage={usage} onUpgrade={() => setTab('billing')} />
          )}
          {activeTab === 'capabilities' && (
            <CapabilitiesSettings settings={settings} plan={plan} saving={saving} onSave={saveSettings} />
          )}
          {activeTab === 'connectors' && (
            <ConnectorsSettings user={user} />
          )}
          {activeTab === 'memory' && (
            <MemorySettings
              settings={settings}
              memories={memories}
              saving={saving}
              onSave={saveSettings}
              onAdd={addMemory}
              onDelete={deleteMemory}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
