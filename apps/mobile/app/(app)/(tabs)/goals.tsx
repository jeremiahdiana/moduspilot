import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useGoals } from '@/hooks/useCollections';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { haptics } from '@/lib/haptics';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { ProgressRing, AnimatedRow, ScreenFade, FadeReveal } from '@/components/ui';
import { EmptyState, CountPill } from '@/components/ui/Common';
import type { Goal } from '@/lib/types';

function GoalRow({ goal }: { goal: Goal }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/(app)/goal/${goal.id}` as never)}
      className="bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl p-4 flex-row items-center gap-4"
    >
      <View className="flex-1 gap-1.5">
        <Text className="text-text font-bold text-base" numberOfLines={2}>{goal.title}</Text>
        {goal.dueDate ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="event" tone="muted" size={13} />
            <Text className="text-muted text-xs">{goal.dueDate}</Text>
          </View>
        ) : (
          <Text className="text-muted text-xs">{goal.progress}% complete</Text>
        )}
      </View>
      <ProgressRing progress={goal.progress} size={58} stroke={5} />
      <Icon name="chevron-right" tone="muted" size={20} />
    </TouchableOpacity>
  );
}

export default function GoalsScreen() {
  const { user } = useAuth();
  const { data: goals, loading } = useGoals(user?.uid);
  const { prompt } = useSheets();

  async function createGoal() {
    if (!user) return;
    const title = (await prompt({ title: 'New goal', placeholder: 'What do you want to achieve?', confirmLabel: 'Create' }))?.trim();
    if (!title) return;
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'goals'), {
        title, progress: 0, status: 'active', notes: [], createdAt: serverTimestamp(),
      });
      haptics.success();
      router.push(`/(app)/goal/${ref.id}` as never);
    } catch { /* non-fatal */ }
  }

  return (
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Goals"
        right={
          <View className="flex-row items-center gap-2">
            {goals.length > 0 ? <CountPill label={`${goals.length} active`} /> : null}
            <TouchableOpacity
              onPress={createGoal}
              activeOpacity={0.8}
              className="w-10 h-10 rounded-xl bg-brand items-center justify-center"
            >
              <Icon name="add" color="#fff" size={22} />
            </TouchableOpacity>
          </View>
        }
      />

      <FadeReveal
        loading={loading}
        skeleton={<SkeletonList count={5}><SkeletonCard /></SkeletonList>}
      >
        {goals.length === 0 ? (
          <EmptyState
            icon="flag"
            title="No goals yet"
            subtitle="Tell MODUS what you're working toward and it'll help you shape the goal."
            action={{
              label: 'Set a goal with MODUS',
              icon: 'auto-awesome',
              onPress: () => router.push({ pathname: '/(app)/(tabs)/chat', params: { prefill: 'Help me set a new goal.' } }),
            }}
          />
        ) : (
          <FlatList
            data={goals}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            initialNumToRender={20}
            removeClippedSubviews={false}
            renderItem={({ item, index }) => <AnimatedRow index={index}><GoalRow goal={item} /></AnimatedRow>}
            showsVerticalScrollIndicator={false}
          />
        )}
      </FadeReveal>
      </SafeAreaView>
    </ScreenFade>
  );
}
