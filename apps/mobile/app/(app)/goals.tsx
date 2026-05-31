import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { ProgressRing } from '@/components/ui';
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
    <View className="bg-surface border border-border rounded-3xl p-4 flex-row items-center gap-4">
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
    </View>
  );
}

export default function GoalsScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;

    // Paint last-known goals instantly while the live listener revalidates.
    readCache<Goal[]>(`goals.${user.uid}`).then(cached => {
      if (alive && cached) { setGoals(cached); setLoading(false); }
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
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader
        title="Goals"
        right={goals.length > 0 ? <CountPill label={`${goals.length} active`} /> : undefined}
      />

      {loading ? (
        <SkeletonList count={5}>
          <SkeletonCard />
        </SkeletonList>
      ) : goals.length === 0 ? (
        <EmptyState icon="flag" title="No goals yet" subtitle="Ask MODUS in chat to help you set a goal." />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <GoalRow goal={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
