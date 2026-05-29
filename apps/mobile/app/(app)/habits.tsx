import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

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
  const done = habit.completedDates.includes(today);

  return (
    <View className="bg-surface rounded-2xl px-4 py-4 flex-row items-center gap-3">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: done ? '#7C3AED' : '#2a2a3d',
          backgroundColor: done ? '#7C3AED' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done && (
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', lineHeight: 16 }}>✓</Text>
        )}
      </TouchableOpacity>

      <Text
        className="flex-1 text-text font-medium text-base"
        numberOfLines={1}
        style={[
          { opacity: done ? 0.5 : 1 },
          done ? { textDecorationLine: 'line-through' as const } : {},
        ]}
      >
        {habit.title}
      </Text>

      <View className="items-end">
        <Text className="text-base">{habit.streak > 0 ? '🔥' : '💤'}</Text>
        <Text className="text-muted text-xs">{habit.streak}d</Text>
      </View>
    </View>
  );
}

export default function HabitsScreen() {
  const { user } = useAuth();
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
    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), {
      completedDates: newDates,
      streak,
    });
  }

  const doneCount = habits.filter(h => h.completedDates.includes(today)).length;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-5 py-3 border-b border-border flex-row items-center justify-between">
        <Text className="text-xl font-black text-text">Habits</Text>
        {habits.length > 0 && (
          <Text className="text-muted text-sm">{doneCount}/{habits.length} today</Text>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : habits.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text className="text-4xl">🔥</Text>
          <Text className="text-text font-semibold text-base">No habits yet</Text>
          <Text className="text-muted text-sm text-center">
            Ask MODUS in chat to help you build a habit.
          </Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <HabitRow habit={item} onToggle={() => toggleToday(item)} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
