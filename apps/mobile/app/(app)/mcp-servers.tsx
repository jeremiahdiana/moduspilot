import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { useThemeColors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';

interface McpServer {
  id: string;
  name: string;
  url: string;
  authHeader?: string;
}

export default function McpServersScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const { prompt, confirm } = useSheets();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authHeader, setAuthHeader] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'mcpServers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setServers(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? 'Unnamed',
        url: d.data().url ?? '',
        authHeader: d.data().authHeader ?? undefined,
      })));
    }, () => {});
  }, [user]);

  async function saveServer() {
    if (!user || !name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'mcpServers'), {
        name: name.trim(),
        url: url.trim(),
        authHeader: authHeader.trim() || null,
        createdAt: serverTimestamp(),
      });
      haptics.medium();
      setName(''); setUrl(''); setAuthHeader(''); setAdding(false);
    } catch { /* non-fatal */ } finally { setSaving(false); }
  }

  async function removeServer(server: McpServer) {
    if (!user) return;
    const ok = await confirm({ title: `Remove "${server.name}"?`, message: 'This MCP server will no longer be available in MODUS.', confirmLabel: 'Remove', destructive: true });
    if (ok) deleteDoc(doc(db, 'users', user.uid, 'mcpServers', server.id)).catch(() => {});
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader
        title="MCP Servers"
        right={
          <TouchableOpacity
            onPress={() => setAdding(v => !v)}
            activeOpacity={0.8}
            className={`w-10 h-10 rounded-xl items-center justify-center ${adding ? 'bg-surface border border-border' : 'bg-brand'}`}
          >
            <Icon name={adding ? 'close' : 'add'} color={adding ? c.muted : '#fff'} size={22} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} showsVerticalScrollIndicator={false}>

          {/* Explainer */}
          <View className="bg-surface border border-border rounded-2xl p-4 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Icon name="hub" tone="brand" size={18} />
              <Text className="text-text font-semibold text-sm">What are MCP servers?</Text>
            </View>
            <Text className="text-muted text-xs leading-5">
              MCP (Model Context Protocol) servers extend MODUS with custom tools — connect your own APIs, databases, or internal systems so MODUS can take actions on your behalf.
            </Text>
          </View>

          {/* Add form */}
          {adding && (
            <View className="bg-surface border border-brand/30 rounded-2xl p-4 gap-3">
              <Text className="text-text font-semibold text-sm">New MCP server</Text>
              <Field label="Name" value={name} onChange={setName} placeholder="e.g. My CRM" />
              <Field label="URL" value={url} onChange={setUrl} placeholder="https://mcp.example.com/sse" autoCapitalize="none" />
              <Field label="Auth header (optional)" value={authHeader} onChange={setAuthHeader} placeholder="Bearer sk-…" autoCapitalize="none" secureTextEntry />
              <TouchableOpacity
                onPress={saveServer}
                activeOpacity={0.8}
                disabled={!name.trim() || !url.trim() || saving}
                className="bg-brand rounded-xl py-3 items-center"
                style={{ opacity: (!name.trim() || !url.trim() || saving) ? 0.5 : 1 }}
              >
                <Text className="text-white font-semibold">{saving ? 'Adding…' : 'Add server'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Server list */}
          {servers.length === 0 && !adding ? (
            <View className="items-center py-16 gap-3">
              <View className="w-12 h-12 rounded-2xl bg-surface-2 border border-border items-center justify-center">
                <Icon name="hub" tone="muted" size={22} />
              </View>
              <Text className="text-text font-semibold">No MCP servers yet</Text>
              <Text className="text-muted text-sm text-center leading-5">Tap + to connect your first MCP server and give MODUS access to custom tools.</Text>
            </View>
          ) : (
            <View className="bg-surface border border-border rounded-2xl overflow-hidden">
              {servers.map((s, i) => (
                <View key={s.id} className={`px-4 py-3.5 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <View className="w-8 h-8 rounded-xl bg-brand/10 items-center justify-center">
                    <Icon name="hub" tone="brand" size={17} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-[15px] font-medium">{s.name}</Text>
                    <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{s.url}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeServer(s)} className="p-1.5" activeOpacity={0.7}>
                    <Icon name="delete-outline" tone="muted" size={18} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, autoCapitalize, secureTextEntry }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  autoCapitalize?: 'none' | 'sentences'; secureTextEntry?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View className="gap-1">
      <Text className="text-muted text-xs font-semibold uppercase tracking-wider">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        className="bg-bg border border-border rounded-xl px-4 py-3 text-text text-[15px]"
      />
    </View>
  );
}
