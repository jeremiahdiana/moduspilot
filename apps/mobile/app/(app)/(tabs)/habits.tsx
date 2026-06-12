import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useHabits } from '@/hooks/useCollections';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { SkeletonList, SkeletonHabitRow } from '@/components/Skeleton';
import { EmptyState, CountPill, AnimatedRow, ScreenFade, FadeReveal } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { Habit } from '@/lib/types';

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
    <View className="bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl px-4 py-4 flex-row items-center gap-3.5">
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
  const { data: habits, loading } = useHabits(user?.uid);

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
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Habits"
        right={habits.length > 0 ? <CountPill label={`${doneCount}/${habits.length} today`} /> : undefined}
      />

      <FadeReveal
        loading={loading}
        skeleton={<SkeletonList count={5}><SkeletonHabitRow /></SkeletonList>}
      >
        {habits.length === 0 ? (
          <EmptyState
            icon="local-fire-department"
            title="No habits yet"
            subtitle="Pick something to do daily and MODUS will help you keep the streak."
            action={{
              label: 'Build a habit with MODUS',
              icon: 'auto-awesome',
              onPress: () => router.push({ pathname: '/(app)/(tabs)/chat', params: { prefill: 'Help me build a new habit.' } }),
            }}
          />
        ) : (
          <FlatList
            data={habits}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            initialNumToRender={20}
            removeClippedSubviews={false}
            renderItem={({ item, index }) => <AnimatedRow index={index}><HabitRow habit={item} onToggle={() => toggleToday(item)} /></AnimatedRow>}
            showsVerticalScrollIndicator={false}
          />
        )}
      </FadeReveal>
      </SafeAreaView>
    </ScreenFade>
  );
}
