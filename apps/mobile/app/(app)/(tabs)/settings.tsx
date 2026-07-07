import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Switch, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { API_BASE, getAuthHeader } from '@/lib/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenFade } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { useThemeColors, useThemeToggle } from '@/lib/theme';
import { getSettings, saveSettings, currentUid, type UserSettings } from '@/lib/settings';

export default function SettingsScreen() {
  const user = auth.currentUser;
  const c = useThemeColors();
  const { isDark, setDark } = useThemeToggle();
  const { confirm } = useSheets();
  const [deleting, setDeleting] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({});

  const uid = currentUid();
  useEffect(() => {
    if (uid) getSettings(uid).then(setSettings);
  }, [uid]);

  async function toggleCapability(key: keyof import('@/lib/settings').Capabilities, value: boolean) {
    if (!uid) return;
    setSettings(s => ({ ...s, capabilities: { ...s.capabilities, [key]: value } }));
    const next = await saveSettings(uid, settings, { capabilities: { [key]: value } });
    setSettings(next);
  }

  // Show/hide a sidebar destination (hidden items stay reachable elsewhere).
  async function toggleSidebarItem(key: string, show: boolean) {
    if (!uid) return;
    const current = settings.sidebar?.hidden ?? [];
    const hidden = show ? current.filter(k => k !== key) : Array.from(new Set([...current, key]));
    setSettings(s => ({ ...s, sidebar: { ...s.sidebar, hidden } }));
    const next = await saveSettings(uid, settings, {
      sidebar: { hidden, workspaceCollapsed: settings.sidebar?.workspaceCollapsed },
    });
    setSettings(next);
  }

  async function handleSignOut() {
    const ok = await confirm({ title: 'Sign out', message: 'Are you sure?', confirmLabel: 'Sign out', destructive: true });
    if (ok) signOut(auth);
  }

  async function deleteAccount() {
    if (!auth.currentUser) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/api/account/delete`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await signOut(auth);
    } catch {
      setDeleting(false);
      Alert.alert('Delete failed', 'Could not delete your account. Please try again.');
    }
  }

  async function confirmDelete() {
    const ok = await confirm({
      title: 'Delete account?',
      message: 'This permanently deletes your account and all goals, habits, tasks, conversations, and memories. This cannot be undone.',
      confirmLabel: 'Delete everything',
      destructive: true,
    });
    if (ok) deleteAccount();
  }

  return (
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
       <View className="gap-3">
        {/* Account info → profile */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(app)/profile' as never)}
          className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center gap-3.5"
        >
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : (
            <View className="w-[52px] h-[52px] rounded-full items-center justify-center bg-brand/10">
              <Text className="text-brand font-display font-bold text-xl">
                {(user?.displayName ?? user?.email ?? '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-text font-bold text-base">{user?.displayName ?? 'User'}</Text>
            <Text className="text-muted text-sm">{user?.email ?? ''}</Text>
          </View>
          <Icon name="chevron-right" tone="muted" size={20} />
        </TouchableOpacity>

        {/* Preferences */}
        <View className="bg-surface border border-border rounded-xl overflow-hidden">
          <ToggleRow icon={isDark ? 'dark-mode' : 'light-mode'} label="Dark mode" value={isDark} onChange={setDark} brand={c.brand} border={c.border} />
          <Divider />
          <NavRow icon="person-outline" label="Personal context" onPress={() => router.push('/(app)/personal-context' as never)} />
          <Divider />
          <NavRow icon="tune" label="Brain" onPress={() => router.push('/(app)/model-settings' as never)} />
          <Divider />
          <NavRow icon="psychology" label="Memory" onPress={() => router.push('/(app)/memory' as never)} />
          <Divider />
          <NavRow icon="lightbulb-outline" label="Tips & Tricks" onPress={() => router.push('/(app)/tips' as never)} />
        </View>

        {/* Capabilities */}
        <View className="bg-surface border border-border rounded-xl overflow-hidden">
          <ToggleRow
            icon="search" label="Web search" sub="Let MODUS search the web"
            value={!!settings.capabilities?.webSearch}
            onChange={v => toggleCapability('webSearch', v)} brand={c.brand} border={c.border}
          />
          <Divider />
          <ToggleRow
            icon="mic-none" label="Voice input" sub="Mic button in chat"
            value={settings.capabilities?.voiceInput !== false}
            onChange={v => toggleCapability('voiceInput', v)} brand={c.brand} border={c.border}
          />
          <Divider />
          <ToggleRow
            icon="wb-sunny" label="Daily briefing" sub="Morning brief with your priorities"
            value={!!settings.capabilities?.dailyBriefing}
            onChange={v => toggleCapability('dailyBriefing', v)} brand={c.brand} border={c.border}
          />
          <Divider />
          <ToggleRow
            icon="inbox" label="Inbox triage" sub="Draft replies to emails waiting on you"
            value={!!settings.capabilities?.inboxTriage}
            onChange={v => toggleCapability('inboxTriage', v)} brand={c.brand} border={c.border}
          />
          <Divider />
          <ToggleRow
            icon="people-outline" label="Relationship follow-ups" sub="Reconnect with people you've drifted from"
            value={!!settings.capabilities?.relationshipNurture}
            onChange={v => toggleCapability('relationshipNurture', v)} brand={c.brand} border={c.border}
          />
        </View>

        {/* Sidebar — show/hide menu destinations */}
        <View>
          <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Sidebar menu</Text>
          <View className="bg-surface border border-border rounded-xl overflow-hidden">
            {([
              { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
              { key: 'briefing', icon: 'wb-sunny', label: 'Briefing' },
              { key: 'projects', icon: 'folder', label: 'Projects' },
              { key: 'goals', icon: 'flag', label: 'Goals' },
              { key: 'reminders', icon: 'checklist', label: 'Reminders' },
              { key: 'notes', icon: 'sticky-note-2', label: 'Notes' },
              { key: 'group', icon: 'group', label: 'Group' },
              { key: 'capabilities', icon: 'hub', label: 'Connections' },
            ] as { key: string; icon: IconName; label: string }[]).map((item, i) => (
              <View key={item.key}>
                {i > 0 && <Divider />}
                <ToggleRow
                  icon={item.icon} label={item.label}
                  value={!(settings.sidebar?.hidden ?? []).includes(item.key)}
                  onChange={v => toggleSidebarItem(item.key, v)} brand={c.brand} border={c.border}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Account & integrations */}
        <View className="bg-surface border border-border rounded-xl overflow-hidden">
          <NavRow icon="group" label="Group" onPress={() => router.push('/(app)/group' as never)} />
          <Divider />
          <NavRow icon="hub" label="Connectors" onPress={() => router.push('/(app)/connectors' as never)} />
          <Divider />
          <NavRow icon="terminal" label="MCP Servers" onPress={() => router.push('/(app)/mcp-servers' as never)} />
          <Divider />
          <NavRow icon="credit-card" label="Billing & plan" onPress={() => router.push('/(app)/billing' as never)} />
        </View>

        <View className="gap-3 mt-2">
          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-border rounded-xl py-4 flex-row items-center justify-center gap-2"
          >
            <Icon name="logout" tone="text" size={20} />
            <Text className="text-text font-semibold">Sign Out</Text>
          </TouchableOpacity>

          {/* Delete account */}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
            className="border border-red-900/40 rounded-xl py-4 items-center flex-row justify-center gap-2"
          >
            {deleting ? <ActivityIndicator color="#f87171" size="small" /> : <Icon name="delete-outline" color="#f87171" size={20} />}
            <Text className="text-red-400 font-semibold">{deleting ? 'Deleting…' : 'Delete Account'}</Text>
          </TouchableOpacity>
        </View>
       </View>
      </ScrollView>
      </SafeAreaView>
    </ScreenFade>
  );
}

function Divider() {
  return <View className="h-px bg-border ml-14" />;
}

function NavRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center gap-3.5 px-4 py-4">
      <Icon name={icon} tone="muted" size={22} />
      <Text className="text-text font-medium text-[15px] flex-1">{label}</Text>
      <Icon name="chevron-right" tone="muted" size={20} />
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, sub, value, onChange, brand, border }: {
  icon: IconName; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; brand: string; border: string;
}) {
  return (
    <View className="flex-row items-center gap-3.5 px-4 py-3">
      <Icon name={icon} tone="muted" size={22} />
      <View className="flex-1">
        <Text className="text-text font-medium text-[15px]">{label}</Text>
        {sub ? <Text className="text-muted text-xs">{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand, false: border }} thumbColor="#ffffff" ios_backgroundColor={border} />
    </View>
  );
}
