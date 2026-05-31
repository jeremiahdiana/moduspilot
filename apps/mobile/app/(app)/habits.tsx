import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';

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
    <View className="bg-surface border border-border rounded-2xl px-4 py-4 flex-row items-center gap-3">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{
          width: 26, height: 26, borderRadius: 8, borderWidth: 2,
          borderColor: done ? c.brand : c.border,
          backgroundColor: done ? c.brand : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <Icon name="check" color="#fff" size={16} />}
      </TouchableOpacity>

      <Text
        className="flex-1 text-text font-medium text-base"
        numberOfLines={1}
        style={[{ opacity: done ? 0.5 : 1 }, done ? { textDecorationLine: 'line-through' as const } : {}]}
      >
        {habit.title}
      </Text>

      <View className="flex-row items-center gap-1">
        <Icon name="local-fire-department" size={18} color={habit.streak > 0 ? c.brand : c.muted} />
        <Text className="text-muted text-xs">{habit.streak}d</Text>
      </View>
    </View>
  );
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setHabits(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        streak: d.data().streak ?? 0,
        completedDates: d.data().completedDates ?? [],
        frequency: d.data().frequency ?? 'daily',
      })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  async function toggleToday(habit: Habit) {
    if (!user) return;
    const done = habit.completedDates.includes(today);
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
        right={habits.length > 0 ? <Text className="text-muted text-sm">{doneCount}/{habits.length} today</Text> : undefined}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.brand} />
        </View>
      ) : habits.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="local-fire-department" tone="muted" size={44} />
          <Text className="text-text font-semibold text-base">No habits yet</Text>
          <Text className="text-muted text-sm text-center">Ask MODUS in chat to help you build a habit.</Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <HabitRow habit={item} onToggle={() => toggleToday(item)} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
