import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { SkeletonList, SkeletonHabitRow } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { EmptyState, CountPill, AnimatedRow } from '@/components/ui';
import { haptics } from '@/lib/haptics';

interface Habit {
  id: string;
  title: string;
  streak: number;
  completedDates: string[];
  frequency: 'daily' | 'weekly';
}

const today = new Date().toISOString().slice(0, 10);

function recalcStreak(dates: string[], unchecking: boolean): number {
  const sorted = [...dates].sort().reverse();
  let streak = 0;
  const cursor = new Date();
  if (unchecking) cursor.setDate(cursor.getDate() - 1);
  for (const d of sorted) {
    if (d === cursor.toISOString().slice(0, 10)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function HabitRow({ habit, onToggle }: { habit: Habit; onToggle: () => void }) {
  const c = useThemeColors();
  const done = habit.completedDates.includes(today);

  return (
    <View className="bg-surface/70 border border-border/60 rounded-2xl px-4 py-4 flex-row items-center gap-3.5">
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        {done ? (
          <View
            className="bg-brand"
            style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="check" color="#fff" size={18} />
          </View>
        ) : (
          <View
            style={{
              width: 30, height: 30, borderRadius: 15, borderWidth: 2,
              borderColor: c.border, alignItems: 'center', justifyContent: 'center',
            }}
          />
        )}
      </TouchableOpacity>

      <Text
        className="flex-1 text-text font-semibold text-base"
        numberOfLines={1}
        style={[{ opacity: done ? 0.45 : 1 }, done ? { textDecorationLine: 'line-through' as const } : {}]}
      >
        {habit.title}
      </Text>

      {habit.streak > 0 ? (
        <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-brand/10">
          <Icon name="local-fire-department" size={15} tone="brand" />
          <Text className="text-brand text-xs font-bold">{habit.streak}</Text>
        </View>
      ) : (
        <Icon name="local-fire-department" size={16} tone="muted" />
      )}
    </View>
  );
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;

    readCache<Habit[]>(`habits.${user.uid}`).then(cached => {
      if (alive && cached) { setHabits(cached); setLoading(false); }
    });

    const q = query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const next = snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        streak: d.data().streak ?? 0,
        completedDates: d.data().completedDates ?? [],
        frequency: (d.data().frequency ?? 'daily') as 'daily' | 'weekly',
      }));
      setHabits(next);
      setLoading(false);
      writeCache(`habits.${user.uid}`, next);
    }, () => setLoading(false));

    return () => { alive = false; unsub(); };
  }, [user]);

  async function toggleToday(habit: Habit) {
    if (!user) return;
    const done = habit.completedDates.includes(today);
    if (done) haptics.light(); else haptics.success();
    const newDates = done
      ? habit.completedDates.filter(d => d !== today)
      : [...habit.completedDates, today];
    const streak = recalcStreak(newDates, done);
    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), { completedDates: newDates, streak });
  }

  const doneCount = habits.filter(h => h.completedDates.includes(today)).length;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Habits"
        right={habits.length > 0 ? <CountPill label={`${doneCount}/${habits.length} today`} /> : undefined}
      />

      {loading ? (
        <SkeletonList count={5}>
          <SkeletonHabitRow />
        </SkeletonList>
      ) : habits.length === 0 ? (
        <EmptyState icon="local-fire-department" title="No habits yet" subtitle="Ask MODUS in chat to help you build a habit." />
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item, index }) => <AnimatedRow index={index}><HabitRow habit={item} onToggle={() => toggleToday(item)} /></AnimatedRow>}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
