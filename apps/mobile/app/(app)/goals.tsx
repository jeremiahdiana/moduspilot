import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon } from '@/components/Icon';
import { SkeletonList, SkeletonCard } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';

interface Goal {
  id: string;
  title: string;
  progress: number;
  dueDate?: string;
  status: string;
  description?: string;
}

function ProgressBar({ progress }: { progress: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(100, Math.max(0, progress)),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
      <Animated.View style={{ width }} className="h-full bg-brand rounded-full" />
    </View>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  return (
    <View className="bg-surface border border-border rounded-2xl px-4 py-4 gap-2.5">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-text font-semibold text-base flex-1" numberOfLines={2}>{goal.title}</Text>
        {goal.dueDate && <Text className="text-muted text-xs mt-0.5 shrink-0">{goal.dueDate}</Text>}
      </View>
      <ProgressBar progress={goal.progress} />
      <Text className="text-muted text-xs">{goal.progress}% complete</Text>
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
        right={goals.length > 0 ? <Text className="text-muted text-sm">{goals.length} active</Text> : undefined}
      />

      {loading ? (
        <SkeletonList count={5}>
          <SkeletonCard />
        </SkeletonList>
      ) : goals.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="flag" tone="muted" size={44} />
          <Text className="text-text font-semibold text-base">No goals yet</Text>
          <Text className="text-muted text-sm text-center">Ask MODUS in chat to help you set a goal.</Text>
        </View>
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
