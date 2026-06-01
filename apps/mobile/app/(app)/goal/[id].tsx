import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  doc, onSnapshot, updateDoc, deleteDoc, arrayUnion,
  collection, query, where, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';

interface Note { id: string; content: string; date: string; }
interface Goal {
  title: string;
  description?: string;
  progress: number;
  status: string;
  dueDate?: string;
  notes: Note[];
}
interface GoalTask { id: string; title: string; done: boolean; }

const QUICK = [0, 25, 50, 75, 100];

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const c = useThemeColors();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<GoalTask[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'goals', id), snap => {
      const d = snap.data();
      if (!d) { setGoal(null); return; }
      setGoal({
        title: d.title ?? 'Untitled',
        description: d.description,
        progress: d.progress ?? 0,
        status: d.status ?? 'active',
        dueDate: d.dueDate,
        notes: (d.notes as Note[]) ?? [],
      });
    });
    return unsub;
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('goalId', '==', id));
    return onSnapshot(q, snap => {
      setTasks(snap.docs
        .map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', done: d.data().done ?? false }))
        .filter(t => !(t as { deleted?: boolean }).deleted));
    });
  }, [user, id]);

  const ref = () => doc(db, 'users', user!.uid, 'goals', id!);

  function setProgress(p: number) {
    if (!user || !id) return;
    const clamped = Math.max(0, Math.min(100, p));
    if (clamped >= 100) haptics.success(); else haptics.light();
    updateDoc(ref(), {
      progress: clamped,
      progressLog: arrayUnion({ progress: clamped, date: new Date().toISOString().slice(0, 10) }),
      ...(clamped >= 100 ? { status: 'completed' } : {}),
    }).catch(() => {});
  }

  function editField(field: 'title' | 'description', label: string) {
    Alert.prompt(label, undefined, text => {
      if (text != null) updateDoc(ref(), { [field]: text.trim() }).catch(() => {});
    }, 'plain-text', field === 'title' ? goal?.title : goal?.description);
  }

  function addNote() {
    Alert.prompt('Add note', undefined, text => {
      const content = text?.trim();
      if (!content) return;
      updateDoc(ref(), {
        notes: arrayUnion({ id: `${Date.now()}`, content, date: new Date().toISOString().slice(0, 10) }),
      }).catch(() => {});
    });
  }

  function addTask() {
    if (!user || !id) return;
    Alert.prompt('Add task', undefined, text => {
      const title = text?.trim();
      if (!title) return;
      addDoc(collection(db, 'users', user.uid, 'tasks'), {
        title, done: false, goalId: id, createdAt: serverTimestamp(),
      }).catch(() => {});
    });
  }

  function toggleTask(t: GoalTask) {
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'tasks', t.id), { done: !t.done }).catch(() => {});
  }

  function confirmDelete() {
    Alert.alert('Delete goal?', 'This permanently removes the goal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteDoc(ref()).then(() => router.back()).catch(() => {}),
      },
    ]);
  }

  function menu() {
    Alert.alert(goal?.title ?? 'Goal', undefined, [
      { text: 'Edit title', onPress: () => editField('title', 'Edit title') },
      { text: 'Edit description', onPress: () => editField('description', 'Edit description') },
      goal?.status === 'completed'
        ? { text: 'Reopen', onPress: () => updateDoc(ref(), { status: 'active' }).catch(() => {}) }
        : { text: 'Mark complete', onPress: () => setProgress(100) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!goal) {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <DetailHeader />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader
        right={
          <TouchableOpacity onPress={menu} className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-border">
            <Icon name="more-horiz" tone="text" size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Title + ring */}
        <View className="items-center gap-4">
          <ProgressRing progress={goal.progress} size={132} stroke={10} />
          <TouchableOpacity onPress={() => editField('title', 'Edit title')} activeOpacity={0.7}>
            <Text className="text-text font-display font-bold text-2xl text-center tracking-tight">{goal.title}</Text>
          </TouchableOpacity>
          {goal.dueDate ? (
            <View className="flex-row items-center gap-1.5">
              <Icon name="event" tone="muted" size={14} />
              <Text className="text-muted text-sm">{goal.dueDate}</Text>
            </View>
          ) : null}
        </View>

        {/* Progress editor */}
        <View className="bg-surface border border-border rounded-3xl p-4 gap-3">
          <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Progress</Text>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setProgress(goal.progress - 5)} className="w-11 h-11 rounded-2xl bg-surface-2 border border-border items-center justify-center">
              <Icon name="remove" tone="text" size={22} />
            </TouchableOpacity>
            <Text className="text-brand font-display font-bold text-2xl">{goal.progress}%</Text>
            <TouchableOpacity onPress={() => setProgress(goal.progress + 5)} className="w-11 h-11 rounded-2xl bg-surface-2 border border-border items-center justify-center">
              <Icon name="add" tone="text" size={22} />
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-2">
            {QUICK.map(q => (
              <TouchableOpacity
                key={q}
                onPress={() => setProgress(q)}
                className={`flex-1 py-2 rounded-xl items-center border ${goal.progress === q ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-border'}`}
              >
                <Text className={`text-xs font-bold ${goal.progress === q ? 'text-brand' : 'text-muted'}`}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <TouchableOpacity onPress={() => editField('description', 'Edit description')} activeOpacity={0.7} className="bg-surface border border-border rounded-3xl p-4 gap-1.5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Description</Text>
          <Text className={goal.description ? 'text-text text-[15px] leading-6' : 'text-muted text-[15px]'}>
            {goal.description || 'Tap to add a description…'}
          </Text>
        </TouchableOpacity>

        {/* Tasks */}
        <Section title="Tasks" onAdd={addTask}>
          {tasks.length === 0 ? (
            <Text className="text-muted text-sm px-1 py-2">No tasks yet. Tap + to add one.</Text>
          ) : (
            tasks.map(t => (
              <TouchableOpacity key={t.id} onPress={() => toggleTask(t)} activeOpacity={0.7} className="flex-row items-center gap-3 py-2.5">
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: t.done ? c.brand : c.border, backgroundColor: t.done ? c.brand : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {t.done && <Icon name="check" color="#fff" size={14} />}
                </View>
                <Text className={`flex-1 text-[15px] ${t.done ? 'text-muted line-through' : 'text-text'}`}>{t.title}</Text>
              </TouchableOpacity>
            ))
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes" onAdd={addNote}>
          {goal.notes.length === 0 ? (
            <Text className="text-muted text-sm px-1 py-2">No notes yet.</Text>
          ) : (
            goal.notes.map(n => (
              <View key={n.id} className="py-2.5 gap-0.5">
                <Text className="text-text text-[15px] leading-6">{n.content}</Text>
                <Text className="text-muted text-xs">{n.date}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <View className="bg-surface border border-border rounded-3xl p-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-muted text-xs font-semibold uppercase tracking-wider">{title}</Text>
        <TouchableOpacity onPress={onAdd} className="w-7 h-7 rounded-full bg-surface-2 border border-border items-center justify-center">
          <Icon name="add" tone="brand" size={18} />
        </TouchableOpacity>
      </View>
      <View className="divide-y divide-border">{children}</View>
    </View>
  );
}
