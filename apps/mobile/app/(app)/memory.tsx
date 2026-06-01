import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui';
import { useSheets } from '@/components/ui/Sheets';
import { subscribeMemories, addMemory, deleteMemory, currentUid, type Memory } from '@/lib/settings';

export default function MemoryScreen() {
  const uid = currentUid();
  const { prompt, confirm } = useSheets();
  const [memories, setMemories] = useState<Memory[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeMemories(uid, setMemories);
  }, [uid]);

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

      {memories.length === 0 ? (
        <EmptyState icon="psychology" title="No memories yet" subtitle="Add facts MODUS should always remember, or it learns them from your chats." />
      ) : (
        <FlatList
          data={memories}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
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
          )}
        />
      )}
    </SafeAreaView>
  );
}
