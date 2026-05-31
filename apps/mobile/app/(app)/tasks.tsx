import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { SkeletonList, SkeletonHabitRow } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { EmptyState, CountPill, AnimatedRow, SwipeToDelete } from '@/components/ui';
import { GRADIENTS, useThemeColors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';

interface Task {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#8b8ba0',
};

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const c = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={onDelete}
      className="bg-surface border border-border rounded-3xl px-4 py-4 flex-row items-center gap-3.5"
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        {task.done ? (
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="check" color="#fff" size={16} />
          </LinearGradient>
        ) : (
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.border }} />
        )}
      </TouchableOpacity>

      <View className="flex-1">
        <Text
          className="text-text font-semibold text-[15px]"
          numberOfLines={1}
          style={[{ opacity: task.done ? 0.45 : 1 }, task.done ? { textDecorationLine: 'line-through' } : {}]}
        >
          {task.title}
        </Text>
        {task.dueDate ? <Text className="text-muted text-xs mt-0.5">{task.dueDate}</Text> : null}
      </View>

      {task.priority ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLOR[task.priority] }} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;

    readCache<Task[]>(`tasks.${user.uid}`).then(cached => {
      if (alive && cached) { setTasks(cached); setLoading(false); }
    });

    const q = query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const next = snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          done: d.data().done ?? false,
          dueDate: d.data().dueDate,
          priority: d.data().priority,
          deleted: d.data().deleted ?? false,
        }))
        .filter(t => !t.deleted)
        .map(({ deleted, ...t }) => t);
      setTasks(next);
      setLoading(false);
      writeCache(`tasks.${user.uid}`, next);
    }, () => setLoading(false));

    return () => { alive = false; unsub(); };
  }, [user]);

  function addTask() {
    if (!user) return;
    Alert.prompt('New task', 'What needs doing?', text => {
      const title = text?.trim();
      if (!title) return;
      addDoc(collection(db, 'users', user.uid, 'tasks'), {
        title, done: false, deleted: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    });
  }

  function toggle(t: Task) {
    if (!user) return;
    if (t.done) haptics.light(); else haptics.success();
    updateDoc(doc(db, 'users', user.uid, 'tasks', t.id), { done: !t.done }).catch(() => {});
  }

  function remove(t: Task) {
    if (!user) return;
    Alert.alert(t.title, 'Delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNow(t) },
    ]);
  }

  function deleteNow(t: Task) {
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'tasks', t.id), { deleted: true }).catch(() => {});
  }

  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const ordered = [...open, ...done];

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Tasks"
        right={
          <TouchableOpacity onPress={addTask} activeOpacity={0.8}>
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="add" color="#fff" size={24} />
            </LinearGradient>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <SkeletonList count={6}>
          <SkeletonHabitRow />
        </SkeletonList>
      ) : tasks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState icon="checklist" title="No tasks yet" subtitle="Tap + to add a task, or ask MODUS in chat." />
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            open.length > 0 ? <View className="px-1 pb-1"><CountPill label={`${open.length} open`} /></View> : null
          }
          renderItem={({ item, index }) => (
            <AnimatedRow index={index}>
              <SwipeToDelete onDelete={() => deleteNow(item)}>
                <TaskRow task={item} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
              </SwipeToDelete>
            </AnimatedRow>
          )}
        />
      )}
    </SafeAreaView>
  );
}
