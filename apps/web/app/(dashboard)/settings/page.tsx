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

const TABS = [
  { key: 'general',      label: 'General',      icon: '◈' },
  { key: 'account',      label: 'Account',      icon: '◎' },
  { key: 'privacy',      label: 'Privacy',      icon: '◉' },
  { key: 'billing',      label: 'Billing',      icon: '◆' },
  { key: 'usage',        label: 'Usage',        icon: '▣' },
  { key: 'capabilities', label: 'Capabilities', icon: '◇' },
  { key: 'connectors',   label: 'Connectors',   icon: '⊕' },
  { key: 'memory',       label: 'Memory',       icon: '⊙' },
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
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="pt-4 border-t border-border">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-panel transition-colors"
          >
            <span className="text-base">→</span>
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
            <UsageSettings plan={plan} usage={usage} />
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
