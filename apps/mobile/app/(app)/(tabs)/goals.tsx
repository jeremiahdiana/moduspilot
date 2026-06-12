import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { readCache, readCacheSync, writeCache } from '@/lib/cache';
import { ProgressRing, AnimatedRow, ScreenFade, FadeReveal } from '@/components/ui';
import { EmptyState, CountPill } from '@/components/ui/Common';

interface Goal {
  id: string;
  title: string;
  progress: number;
  dueDate?: string;
  status: string;
  description?: string;
}

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
  const [goals, setGoals] = useState<Goal[]>(() => readCacheSync<Goal[]>(`goals.${user?.uid ?? ''}`) ?? []);
  const [loading, setLoading] = useState(() => !readCacheSync(`goals.${user?.uid ?? ''}`));

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;

    // Paint last-known goals instantly while the live listener revalidates.
    readCache<Goal[]>(`goals.${user.uid}`).then(cached => {
      if (alive && cached && cached.length > 0) { setGoals(cached); setLoading(false); }
    });

    const q = query(collection(db, 'users', user.uid, 'goals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const next = snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          progress: d.data().progress ?? 0,
          dueDate: d.data().dueDate,
          status: d.data().status ?? 'active',
          description: d.data().description,
        }))
        .filter(g => g.status === 'active');
      setGoals(next);
      setLoading(false);
      writeCache(`goals.${user.uid}`, next);
    }, () => setLoading(false));

    return () => { alive = false; unsub(); };
  }, [user]);

  return (
    <ScreenFade>
      <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Goals"
        right={goals.length > 0 ? <CountPill label={`${goals.length} active`} /> : undefined}
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
