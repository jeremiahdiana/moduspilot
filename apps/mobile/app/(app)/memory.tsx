import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui';
import { useSheets } from '@/components/ui/Sheets';
import { useThemeColors } from '@/lib/theme';
import {
  subscribeMemories, addMemory, deleteMemory, currentUid,
  getSettings, saveSettings, type Memory, type UserSettings,
} from '@/lib/settings';

export default function MemoryScreen() {
  const uid = currentUid();
  const c = useThemeColors();
  const { prompt, confirm } = useSheets();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});

  useEffect(() => {
    if (!uid) return;
    getSettings(uid).then(setSettings);
    return subscribeMemories(uid, setMemories);
  }, [uid]);

  async function toggleVectorMemory(value: boolean) {
    if (!uid) return;
    setSettings(s => ({ ...s, capabilities: { ...s.capabilities, vectorMemory: value } }));
    const next = await saveSettings(uid, settings, { capabilities: { vectorMemory: value } });
    setSettings(next);
  }

  async function add() {
    if (!uid) return;
    const text = await prompt({ title: 'Add memory', message: 'A fact MODUS should always remember.', multiline: true, confirmLabel: 'Add' });
    if (text?.trim()) addMemory(uid, text).catch(() => {});
  }

  async function remove(m: Memory) {
    if (!uid) return;
    const ok = await confirm({ title: 'Delete memory?', message: m.content, confirmLabel: 'Delete', destructive: true });
    if (ok) deleteMemory(uid, m.id).catch(() => {});
  }

  // The Vector Memory on/off toggle now lives here with the memories themselves
  // (matches web — memory enable + contents in one place, not orphaned in Capabilities).
  const Header = (
    <View className="px-4 pt-4 gap-3">
      <View className="bg-surface border border-border rounded-xl p-4 flex-row items-center gap-3">
        <Icon name="memory" tone="brand" size={18} />
        <View className="flex-1">
          <Text className="text-text text-[15px] font-medium">Vector Memory</Text>
          <Text className="text-muted text-xs mt-0.5">Recall relevant context across sessions. Off disables long-term recall.</Text>
        </View>
        <Switch
          value={!!settings.capabilities?.vectorMemory}
          onValueChange={toggleVectorMemory}
          trackColor={{ true: c.brand, false: c.border }}
        />
      </View>
      {memories.length > 0 && (
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider px-1">Stored memories</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader
        title="Memory"
        right={
          <TouchableOpacity
            onPress={add}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl bg-brand items-center justify-center"
          >
            <Icon name="add" color="#fff" size={24} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={memories}
        keyExtractor={m => m.id}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="px-4 pt-6">
            <EmptyState icon="psychology" title="No memories yet" subtitle="Add facts MODUS should always remember, or it learns them from your chats." />
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4">
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => remove(item)}
              className="bg-surface border border-border rounded-xl p-4 flex-row items-start gap-3"
            >
              <Icon name="psychology" tone="brand" size={18} />
              <View className="flex-1">
                <Text className="text-text text-[15px] leading-6">{item.content}</Text>
                <Text className="text-muted text-xs mt-1 capitalize">{item.source}</Text>
              </View>
              <TouchableOpacity onPress={() => remove(item)} hitSlop={8}>
                <Icon name="close" tone="muted" size={16} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
