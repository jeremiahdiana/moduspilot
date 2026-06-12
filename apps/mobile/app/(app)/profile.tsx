import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { DetailHeader } from '@/components/DetailHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useSheets } from '@/components/ui/Sheets';
import { haptics } from '@/lib/haptics';
import type { Plan } from '@/lib/types';
const PLAN_LABEL: Record<NonNullable<Plan>, string> = { free: 'Free', modus: 'MODUS', pilot: 'PILOT' };

const PROVIDER: Record<string, { label: string; icon: IconName }> = {
  'google.com': { label: 'Google', icon: 'mail' },
  'apple.com': { label: 'Apple', icon: 'phone-iphone' },
  password: { label: 'Email & password', icon: 'lock-outline' },
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 bg-surface border border-border rounded-2xl py-4 items-center">
      <Text className="text-text font-display font-bold text-2xl">{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { prompt } = useSheets();
  const [plan, setPlan] = useState<NonNullable<Plan>>('free');
  const [activeGoals, setActiveGoals] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [topStreak, setTopStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    const subs = [
      onSnapshot(doc(db, 'users', user.uid), snap => {
        const p = snap.data()?.plan;
        setPlan(p === 'modus' || p === 'pilot' ? p : 'free');
      }),
      onSnapshot(collection(db, 'users', user.uid, 'goals'), snap => {
        setActiveGoals(snap.docs.filter(d => {
          const g = d.data();
          return g.status !== 'completed' && g.status !== 'deleted' && !g.deleted;
        }).length);
      }),
      onSnapshot(collection(db, 'users', user.uid, 'tasks'), snap => {
        setTasksDone(snap.docs.filter(d => d.data().done && !d.data().deleted).length);
      }),
      onSnapshot(collection(db, 'users', user.uid, 'habits'), snap => {
        setTopStreak(snap.docs.reduce((max, d) => Math.max(max, d.data().streak ?? 0), 0));
      }),
    ];
    return () => subs.forEach(u => u());
  }, [user]);

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;
  const providers = (user?.providerData ?? []).map(p => p.providerId).filter(id => PROVIDER[id]);

  async function editName() {
    if (!auth.currentUser) return;
    const name = (await prompt({ title: 'Display name', defaultValue: user?.displayName ?? '', confirmLabel: 'Save' }))?.trim();
    if (!name) return;
    haptics.success();
    updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
  }

  const initial = (user?.displayName ?? user?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <DetailHeader title="Profile" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View className="items-center gap-3 pt-2">
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={{ width: 88, height: 88, borderRadius: 44 }} />
          ) : (
            <View className="w-[88px] h-[88px] rounded-full items-center justify-center bg-brand/10 border border-brand/20">
              <Text className="text-brand font-display font-bold text-4xl">{initial}</Text>
            </View>
          )}
          <View className="items-center gap-1">
            <TouchableOpacity onPress={editName} activeOpacity={0.7} className="flex-row items-center gap-1.5">
              <Text className="text-text font-display font-bold text-2xl tracking-tight">{user?.displayName ?? 'User'}</Text>
              <Icon name="edit" tone="muted" size={15} />
            </TouchableOpacity>
            <Text className="text-muted text-sm">{user?.email ?? ''}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/25">
            <Icon name="workspace-premium" tone="brand" size={14} />
            <Text className="text-brand text-xs font-bold tracking-wide">{PLAN_LABEL[plan]} plan</Text>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3">
          <Stat value={activeGoals} label="Active goals" />
          <Stat value={tasksDone} label="Tasks done" />
          <Stat value={topStreak} label="Top streak" />
        </View>

        {/* Plan card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(app)/billing')}
          className="flex-row items-center gap-3 rounded-xl bg-surface border border-border px-4 py-4"
        >
          <View className="w-9 h-9 rounded-xl bg-brand/10 items-center justify-center">
            <Icon name="credit-card" tone="brand" size={18} />
          </View>
          <View className="flex-1">
            <Text className="text-text font-semibold text-[15px]">{plan === 'free' ? 'Upgrade your plan' : 'Manage subscription'}</Text>
            <Text className="text-muted text-xs mt-0.5">{plan === 'free' ? 'Unlock unlimited everything' : `You're on ${PLAN_LABEL[plan]}`}</Text>
          </View>
          <Icon name="chevron-right" tone="muted" size={20} />
        </TouchableOpacity>

        {/* Sign-in methods */}
        <View className="bg-surface border border-border rounded-xl p-4 gap-3">
          <Text className="text-muted text-xs font-semibold uppercase tracking-wider">Sign-in methods</Text>
          {providers.length === 0 ? (
            <Text className="text-muted text-sm">No linked accounts.</Text>
          ) : (
            providers.map(id => (
              <View key={id} className="flex-row items-center gap-3">
                <Icon name={PROVIDER[id].icon} tone="text" size={18} />
                <Text className="text-text text-[15px] flex-1">{PROVIDER[id].label}</Text>
                <Icon name="check-circle" tone="brand" size={16} />
              </View>
            ))
          )}
        </View>

        {memberSince ? (
          <Text className="text-muted text-xs text-center">Member since {memberSince}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
