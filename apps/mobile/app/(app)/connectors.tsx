import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { useSheets } from '@/components/ui/Sheets';
import { haptics } from '@/lib/haptics';
import {
  fetchConnectorStatus, connectProvider, disconnectProvider,
  type ConnectorStatus, type ConnectorProvider,
} from '@/lib/api';

interface Row { label: string; sub: string; key: Record<string, string> }

const META: { provider: ConnectorProvider; name: string; icon: IconName; color: string; desc: string }[] = [
  { provider: 'google', name: 'Google', icon: 'mail-outline', color: '#ea4335', desc: 'Gmail, Calendar & Drive' },
  { provider: 'notion', name: 'Notion', icon: 'description', color: '#7c3aed', desc: 'Pages & databases' },
  { provider: 'slack', name: 'Slack', icon: 'tag', color: '#e01e5a', desc: 'Channels & messages' },
  { provider: 'github', name: 'GitHub', icon: 'code', color: '#6e7681', desc: 'Repos, issues & PRs' },
];

function rowsFor(p: ConnectorProvider, s: ConnectorStatus): Row[] {
  if (p === 'google') return s.google.map(a => ({ label: a.email, sub: 'Connected', key: { email: a.email } }));
  if (p === 'notion') return s.notion.map(a => ({ label: a.workspaceName || a.ownerEmail, sub: a.ownerEmail, key: { workspaceId: a.workspaceId } }));
  if (p === 'slack') return s.slack.map(a => ({ label: a.teamName, sub: 'Workspace', key: { teamId: a.teamId } }));
  return s.github.map(a => ({ label: a.name || a.login, sub: `@${a.login}`, key: { login: a.login } }));
}

export default function ConnectorsScreen() {
  const c = useThemeColors();
  const { confirm } = useSheets();
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [busy, setBusy] = useState<ConnectorProvider | null>(null);

  const load = useCallback(async () => {
    try { setStatus(await fetchConnectorStatus()); } catch { /* keep last */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function connect(p: ConnectorProvider) {
    if (busy) return;
    haptics.medium();
    setBusy(p);
    try {
      const url = await connectProvider(p);
      await WebBrowser.openBrowserAsync(url);
      await load(); // refresh after the user finishes consent + closes the browser
    } catch {
      Alert.alert('Connect failed', 'Could not start the connection. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(p: ConnectorProvider, name: string, key: Record<string, string>) {
    const ok = await confirm({ title: `Disconnect ${name}?`, message: 'MODUS will lose access to this account.', confirmLabel: 'Disconnect', destructive: true });
    if (!ok) return;
    haptics.select();
    try {
      await disconnectProvider(p, key);
      await load();
    } catch {
      Alert.alert('Disconnect failed', 'Please try again.');
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Connectors" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        {!status ? (
          <View className="items-center py-16"><ActivityIndicator color={c.brand} /></View>
        ) : (
          <View className="gap-4">
            {META.map(m => {
              const rows = rowsFor(m.provider, status);
              return (
                <View key={m.provider} className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <View className="flex-row items-center gap-3 px-4 py-3.5">
                    <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: m.color + '22' }}>
                      <Icon name={m.icon} size={18} color={m.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-text font-semibold text-[15px]">{m.name}</Text>
                      <Text className="text-muted text-xs">{m.desc}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => connect(m.provider)}
                      disabled={!!busy}
                      activeOpacity={0.8}
                      className="px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10 dark:bg-brand/5"
                    >
                      {busy === m.provider ? <ActivityIndicator color={c.brand} size="small" /> : (
                        <Text className="text-brand text-[12px] font-semibold">{rows.length ? 'Add' : 'Connect'}</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {rows.map((r, i) => (
                    <View key={i} className="flex-row items-center gap-3 px-4 py-3 border-t border-border">
                      <Icon name="check-circle" tone="brand" size={16} />
                      <View className="flex-1">
                        <Text className="text-text text-[13px] font-medium" numberOfLines={1}>{r.label}</Text>
                        <Text className="text-muted text-[11px]">{r.sub}</Text>
                      </View>
                      <TouchableOpacity onPress={() => disconnect(m.provider, m.name, r.key)} activeOpacity={0.7} hitSlop={8}>
                        <Text className="text-red-400 text-[12px] font-medium">Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}

            <Text className="text-muted text-xs text-center px-4 leading-5 mt-1">
              Connecting opens a secure sign-in. After you approve and close it, your accounts appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
