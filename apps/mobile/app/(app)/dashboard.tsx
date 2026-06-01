import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon, type IconName } from '@/components/Icon';
import { AnimatedRow } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { readCache, writeCache } from '@/lib/cache';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Goal { id: string; title: string; progress: number; status: string; deleted?: boolean }
interface Task { id: string; title: string; done: boolean; deleted?: boolean; dueDate?: string }

// ── Inline stat (dense, dot-separated) ────────────────────────────────────────
function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => { haptics.select(); onPress(); }} className="flex-row items-baseline gap-1">
      <Text className="text-text font-bold text-sm tabular-nums">{value}</Text>
      <Text className="text-muted text-sm">{label}</Text>
    </TouchableOpacity>
  );
}
const Dot = () => <Text className="text-border text-sm mx-2">·</Text>;

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <View className="flex-row items-center justify-between mb-2.5">
      <Text className="text-text font-display font-bold text-lg">{title}</Text>
      <TouchableOpacity onPress={() => router.push(href as never)} activeOpacity={0.6}>
        <Text className="text-brand font-semibold text-[13px]">All</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ label, icon, href }: { label: string; icon: IconName; href: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => { haptics.select(); router.push(href as never); }}
      className="flex-row items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-surface"
    >
      <Icon name={icon} tone="brand" size={16} />
      <Text className="text-text font-semibold text-[13px]">{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { open } = useDrawer();
  const firstName = user?.displayName?.split(' ')[0] ?? '';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topStreak, setTopStreak] = useState(0);
  const [focus, setFocus] = useState<{ title: string; source: 'briefing' | 'task' } | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let alive = true;

    readCache<Goal[]>(`dash.goals.${uid}`).then(c => { if (alive && c) setGoals(c); });
    readCache<Task[]>(`dash.tasks.${uid}`).then(c => { if (alive && c) setTasks(c); });

    // Goals — active, newest first (single-field order, no composite index).
    const unsubGoals = onSnapshot(
      query(collection(db, 'users', uid, 'goals'), orderBy('createdAt', 'desc')),
      snap => {
        const next = snap.docs
          .map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', progress: d.data().progress ?? 0, status: d.data().status ?? 'active', deleted: d.data().deleted }))
          .filter(g => g.status === 'active' && !g.deleted);
        setGoals(next);
        writeCache(`dash.goals.${uid}`, next);
      },
      () => {},
    );

    // Tasks — all, filtered client-side (avoids the done+dueDate composite index).
    const unsubTasks = onSnapshot(
      collection(db, 'users', uid, 'tasks'),
      snap => {
        const next = snap.docs
          .map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', done: d.data().done ?? false, deleted: d.data().deleted, dueDate: d.data().dueDate }))
          .filter(t => !t.done && !t.deleted);
        setTasks(next);
        writeCache(`dash.tasks.${uid}`, next);
      },
      () => {},
    );

    // Habits — top streak.
    const unsubHabits = onSnapshot(
      collection(db, 'users', uid, 'habits'),
      snap => {
        const top = snap.docs.reduce((m, d) => Math.max(m, (d.data().streak as number) ?? 0), 0);
        setTopStreak(top);
      },
      () => {},
    );

    // Focus — today's briefing top priority, else first task due today.
    const unsubBriefing = onSnapshot(
      query(collection(db, 'users', uid, 'conversations'), orderBy('createdAt', 'desc'), limit(20)),
      snap => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const brief = snap.docs.find(d => d.data().briefing === true && d.data().briefingData?.top3?.length);
        const top = brief?.data().briefingData?.top3?.[0]?.task as string | undefined;
        const created = brief?.data().createdAt?.toDate?.() ?? new Date(0);
        if (top && created >= start) setFocus({ title: top, source: 'briefing' });
        else setFocus(null); // fall back to task (resolved below via tasks effect)
      },
      () => {},
    );

    return () => { alive = false; unsubGoals(); unsubTasks(); unsubHabits(); unsubBriefing(); };
  }, [user]);

  const dueToday = tasks.filter(t => t.dueDate === todayStr());

  // If no briefing focus, surface the first task due today as "up next".
  useEffect(() => {
    setFocus(prev => {
      if (prev?.source === 'briefing') return prev;
      return dueToday[0] ? { title: dueToday[0].title, source: 'task' } : null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const topGoals = goals.slice(0, 3);

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Top bar: hamburger + live badge */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity
            onPress={open}
            activeOpacity={0.7}
            className="w-10 h-10 items-center justify-center rounded-xl bg-surface border border-border"
          >
            <Icon name="menu" tone="text" size={22} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <Text className="text-muted text-[11px] font-semibold tracking-wide">Live</Text>
          </View>
        </View>

        {/* Greeting — plain, calm, no gradient */}
        <Text className="text-3xl font-display font-bold text-text tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </Text>
        <Text className="text-muted text-sm mt-1.5">{todayLabel()}</Text>

        {/* Dense inline stats */}
        <View className="flex-row items-center flex-wrap mt-3">
          <Stat value={goals.length} label="goals" onPress={() => router.push('/(app)/goals' as never)} />
          <Dot />
          <Stat value={dueToday.length} label="due today" onPress={() => router.push('/(app)/tasks' as never)} />
          {topStreak > 0 && (
            <>
              <Dot />
              <Stat value={topStreak} label="day streak" onPress={() => router.push('/(app)/habits' as never)} />
            </>
          )}
        </View>

        {/* Focus — flat card with a thin accent bar */}
        {focus && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push((focus.source === 'briefing' ? '/(app)/briefing' : '/(app)/tasks') as never)}
            className="flex-row mt-5 rounded-xl border border-border bg-surface overflow-hidden"
          >
            <View className="w-1 bg-brand" />
            <View className="flex-1 px-4 py-3.5">
              <Text className="text-brand text-[10px] font-bold uppercase tracking-widest mb-1">
                {focus.source === 'briefing' ? 'Focus today' : 'Up next'}
              </Text>
              <Text className="text-text font-semibold text-[15px] leading-5" numberOfLines={2}>{focus.title}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <View className="flex-row flex-wrap gap-2 mt-5">
          <QuickAction label="Task" icon="add-task" href="/(app)/tasks" />
          <QuickAction label="Goal" icon="flag" href="/(app)/goals" />
          <QuickAction label="Habit" icon="local-fire-department" href="/(app)/habits" />
          <QuickAction label="Ask MODUS" icon="auto-awesome" href="/(app)/chat" />
        </View>

        {/* Goals preview */}
        <View className="mt-8">
          <SectionHead title="Goals" href="/(app)/goals" />
          {topGoals.length === 0 ? (
            <View className="bg-surface border border-border rounded-xl px-4 py-5 items-center">
              <Text className="text-muted text-sm">No active goals. Ask MODUS to set one.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {topGoals.map((g, i) => (
                <AnimatedRow key={g.id} index={i}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(app)/goal/${g.id}` as never)}
                    className="bg-surface border border-border rounded-xl px-4 py-3.5 gap-2.5"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-text font-medium text-[15px] flex-1" numberOfLines={1}>{g.title}</Text>
                      <Text className="text-muted text-xs font-semibold tabular-nums">{g.progress}%</Text>
                    </View>
                    <View className="h-1 rounded-full bg-surface-2 overflow-hidden">
                      <View className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, g.progress))}%` }} />
                    </View>
                  </TouchableOpacity>
                </AnimatedRow>
              ))}
            </View>
          )}
        </View>

        {/* Due today preview */}
        <View className="mt-8">
          <SectionHead title="Due today" href="/(app)/tasks" />
          {dueToday.length === 0 ? (
            <View className="bg-surface border border-border rounded-xl px-4 py-5 items-center">
              <Text className="text-muted text-sm">Nothing due today. You're clear.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {dueToday.slice(0, 4).map((t, i) => (
                <AnimatedRow key={t.id} index={i}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(app)/tasks' as never)}
                    className="bg-surface border border-border rounded-xl px-4 py-3.5 flex-row items-center gap-3"
                  >
                    <Icon name="radio-button-unchecked" tone="muted" size={19} />
                    <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{t.title}</Text>
                  </TouchableOpacity>
                </AnimatedRow>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
