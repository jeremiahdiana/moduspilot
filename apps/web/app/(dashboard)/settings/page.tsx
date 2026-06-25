'use client';

import { Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import MemorySettings from '@/components/settings/MemorySettings';
import ModelSettings from '@/components/settings/ModelSettings';
import TipsSettings from '@/components/settings/TipsSettings';

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
  { key: 'model',        label: 'Brain',        icon: <TabIcon d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zM12 16a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2v-2a2 2 0 012-2zM4 10a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2H6a2 2 0 01-2-2zM14 10a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
  { key: 'tips',         label: 'Tips & Tricks', icon: <TabIcon d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> },
] as const;

type Tab = typeof TABS[number]['key'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { settings, memories, plan, usage, loading, saving, saveSettings, addMemory, deleteMemory } = useUserSettings(user);

  const rawTab = searchParams.get('tab') ?? 'general';
  const validKeys = TABS.map(t => t.key) as string[];

  // Redirect old connectors tab and any unknown tab
  useEffect(() => {
    if (rawTab === 'connectors') {
      router.replace('/connections');
    } else if (rawTab === 'memory') {
      // Memory merged into the Brain tab.
      router.replace('/settings?tab=model');
    }
  }, [rawTab, router]);

  const activeTab = (validKeys.includes(rawTab) ? rawTab : 'general') as Tab;

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
    <div className="flex h-full overflow-hidden flex-col md:flex-row">
      {/* Mobile: horizontal scrolling tab bar */}
      <div className="md:hidden flex-shrink-0 border-b border-border overflow-x-auto">
        <div className="flex items-center gap-1 px-3 py-2 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap text-red-400 hover:bg-red-900/10 transition-colors ml-1 border-l border-border pl-3"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop: Left nav */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-border py-6 px-3 flex-col">
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
      <main className="flex-1 overflow-y-auto py-6 px-4 md:py-8 md:px-8">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
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
              {activeTab === 'model' && (
                <div className="space-y-12">
                  <ModelSettings settings={settings} plan={plan} saving={saving} onSave={saveSettings} />
                  <MemorySettings
                    settings={settings}
                    memories={memories}
                    saving={saving}
                    onSave={saveSettings}
                    onAdd={addMemory}
                    onDelete={deleteMemory}
                  />
                </div>
              )}
              {activeTab === 'tips' && (
                <TipsSettings />
              )}
            </motion.div>
          </AnimatePresence>
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
