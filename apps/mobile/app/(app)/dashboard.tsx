import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon, type IconName } from '@/components/Icon';
import { AnimatedRow } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { readCache, writeCache } from '@/lib/cache';
import { fetchInbox, fetchTodayEvents, type InboxThread, type CalEvent } from '@/lib/api';

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
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
function initials(from: string) {
  const p = from.trim().split(' ');
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : from.slice(0, 2)).toUpperCase();
}
function avatarColor(name: string) {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

interface Goal { id: string; title: string; progress: number; status: string; deleted?: boolean }
interface Task { id: string; title: string; done: boolean; deleted?: boolean; dueDate?: string }
interface Habit { id: string; title: string; streak: number; completedDates: string[] }
interface BriefPreview { preview: string; createdAt: Date; read: boolean }

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
function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <View className="flex-row items-center justify-between mb-2.5">
      <Text className="text-text font-display font-bold text-lg">{title}</Text>
      {href && (
        <TouchableOpacity onPress={() => router.push(href as never)} activeOpacity={0.6}>
          <Text className="text-brand font-semibold text-[13px]">All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const EmptyRow = ({ text }: { text: string }) => (
  <View className="bg-surface border border-border rounded-xl px-4 py-4 items-center">
    <Text className="text-muted text-sm text-center">{text}</Text>
  </View>
);

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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [topStreak, setTopStreak] = useState(0);
  const [focus, setFocus] = useState<{ title: string; source: 'briefing' | 'task' } | null>(null);
  const [brief, setBrief] = useState<BriefPreview | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [inbox, setInbox] = useState<InboxThread[]>([]);
  const [googleConnected, setGoogleConnected] = useState(true);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let alive = true;

    readCache<Goal[]>(`dash.goals.${uid}`).then(c => { if (alive && c) setGoals(c); });
    readCache<Task[]>(`dash.tasks.${uid}`).then(c => { if (alive && c) setTasks(c); });
    readCache<Habit[]>(`dash.habits.${uid}`).then(c => { if (alive && c) setHabits(c); });
    readCache<CalEvent[]>(`dash.events.${uid}`).then(c => { if (alive && c) setEvents(c); });
    readCache<InboxThread[]>(`dash.inbox.${uid}`).then(c => { if (alive && c) setInbox(c); });

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

    const unsubHabits = onSnapshot(
      query(collection(db, 'users', uid, 'habits'), orderBy('createdAt', 'desc')),
      snap => {
        const next = snap.docs.map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          streak: d.data().streak ?? 0,
          completedDates: d.data().completedDates ?? [],
        }));
        setHabits(next);
        setTopStreak(next.reduce((m, h) => Math.max(m, h.streak), 0));
        writeCache(`dash.habits.${uid}`, next);
      },
      () => {},
    );

    // Latest briefing — drives both the focus chip and the briefing summary.
    const unsubBriefing = onSnapshot(
      query(collection(db, 'users', uid, 'conversations'), orderBy('createdAt', 'desc'), limit(20)),
      snap => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const d = snap.docs.find(x => x.data().briefing === true);
        if (!d) { setBrief(null); setFocus(null); return; }
        const data = d.data();
        const created = data.createdAt?.toDate?.() ?? new Date(0);
        setBrief({ preview: data.messages?.[0]?.content ?? '', createdAt: created, read: data.read ?? false });
        const top = data.briefingData?.top3?.[0]?.task as string | undefined;
        if (top && created >= start) setFocus({ title: top, source: 'briefing' });
        else setFocus(null);
      },
      () => {},
    );

    // Google inbox + calendar (live HTTP, cached for instant paint).
    fetchTodayEvents().then(r => {
      if (!alive) return;
      setEvents(r.events);
      if (r.notConnected) setGoogleConnected(false);
      else writeCache(`dash.events.${uid}`, r.events);
    });
    fetchInbox('primary').then(r => {
      if (!alive) return;
      setInbox(r.threads);
      if (r.notConnected) setGoogleConnected(false);
      else writeCache(`dash.inbox.${uid}`, r.threads);
    });

    return () => { alive = false; unsubGoals(); unsubTasks(); unsubHabits(); unsubBriefing(); };
  }, [user]);

  const dueToday = tasks.filter(t => t.dueDate === todayStr());

  useEffect(() => {
    setFocus(prev => {
      if (prev?.source === 'briefing') return prev;
      return dueToday[0] ? { title: dueToday[0].title, source: 'task' } : null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  async function toggleHabit(h: Habit) {
    if (!user) return;
    haptics.select();
    const done = h.completedDates.includes(todayStr());
    const newDates = done ? h.completedDates.filter(d => d !== todayStr()) : [...h.completedDates, todayStr()];
    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    if (done) check.setDate(check.getDate() - 1);
    for (const d of sorted) {
      if (d === check.toISOString().slice(0, 10)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    updateDoc(doc(db, 'users', user.uid, 'habits', h.id), { completedDates: newDates, streak }).catch(() => {});
  }

  const topGoals = goals.slice(0, 3);
  const briefIsToday = brief ? brief.createdAt >= new Date(new Date().setHours(0, 0, 0, 0)) : false;

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={open} activeOpacity={0.7} className="w-10 h-10 items-center justify-center rounded-xl bg-surface border border-border">
            <Icon name="menu" tone="text" size={22} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <Text className="text-muted text-[11px] font-semibold tracking-wide">Live</Text>
          </View>
        </View>

        {/* Greeting */}
        <Text className="text-3xl font-display font-bold text-text tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </Text>
        <Text className="text-muted text-sm mt-1.5">{todayLabel()}</Text>

        {/* Dense inline stats */}
        <View className="flex-row items-center flex-wrap mt-3">
          <Stat value={goals.length} label="goals" onPress={() => router.push('/(app)/goals' as never)} />
          <Dot />
          <Stat value={dueToday.length} label="due today" onPress={() => router.push('/(app)/tasks' as never)} />
          {topStreak > 0 && (<><Dot /><Stat value={topStreak} label="day streak" onPress={() => router.push('/(app)/habits' as never)} /></>)}
          {inbox.length > 0 && (<><Dot /><Stat value={inbox.length} label="unread" onPress={() => router.push('/(app)/briefing' as never)} /></>)}
        </View>

        {/* Focus */}
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

        {/* Today's schedule (calendar) */}
        <View className="mt-8">
          <SectionHead title="Today's schedule" href="/(app)/briefing" />
          {events.length === 0 ? (
            <EmptyRow text={googleConnected ? 'Nothing scheduled today.' : 'Connect Google in chat to see your schedule.'} />
          ) : (
            <View className="bg-surface border border-border rounded-xl overflow-hidden">
              {events.slice(0, 5).map((e, i) => (
                <View key={e.id} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Text className="text-brand font-semibold text-xs tabular-nums w-16">{fmtTime(e.start)}</Text>
                  <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{e.title}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Today's briefing */}
        <View className="mt-8">
          <SectionHead title="Today's briefing" href="/(app)/briefing" />
          {!brief ? (
            <EmptyRow text="No briefings yet. They arrive at your scheduled time." />
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(app)/briefing' as never)}
              className="bg-surface border border-border rounded-xl px-4 py-3.5"
            >
              <View className="flex-row items-center gap-2 mb-1.5">
                {!brief.read && <View className="w-1.5 h-1.5 rounded-full bg-brand" />}
                <Text className="text-muted text-[11px]">
                  {briefIsToday ? 'Today' : brief.createdAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text className="text-text text-sm leading-5" numberOfLines={4}>{brief.preview}</Text>
              <Text className="text-brand font-semibold text-[13px] mt-2">Read full briefing →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Inbox */}
        {(inbox.length > 0 || !googleConnected) && (
          <View className="mt-8">
            <SectionHead title="Inbox" href="/(app)/briefing" />
            {inbox.length === 0 ? (
              <EmptyRow text="Connect Google in chat to see your inbox." />
            ) : (
              <View className="bg-surface border border-border rounded-xl overflow-hidden">
                {inbox.slice(0, 4).map((t, i) => (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.8}
                    onPress={() => router.push('/(app)/briefing' as never)}
                    className={`flex-row items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <View className="w-7 h-7 rounded-full items-center justify-center mt-0.5" style={{ backgroundColor: avatarColor(t.from) }}>
                      <Text className="text-white text-[10px] font-bold">{initials(t.from)}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-text text-xs font-semibold flex-1" numberOfLines={1}>{t.from}</Text>
                        <Text className="text-muted text-[10px]">{t.date?.slice(0, 6)}</Text>
                      </View>
                      <Text className="text-text text-xs" numberOfLines={1}>{t.subject}</Text>
                      <Text className="text-muted text-[11px] mt-0.5" numberOfLines={1}>{t.snippet}</Text>
                    </View>
                    {t.unread && <View className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Goals */}
        <View className="mt-8">
          <SectionHead title="Goals" href="/(app)/goals" />
          {topGoals.length === 0 ? (
            <EmptyRow text="No active goals. Ask MODUS to set one." />
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

        {/* Due today */}
        <View className="mt-8">
          <SectionHead title="Due today" href="/(app)/tasks" />
          {dueToday.length === 0 ? (
            <EmptyRow text="Nothing due today. You're clear." />
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

        {/* Habits — tap to check in */}
        {habits.length > 0 && (
          <View className="mt-8">
            <SectionHead title="Habits" href="/(app)/habits" />
            <View className="bg-surface border border-border rounded-xl overflow-hidden">
              {habits.slice(0, 5).map((h, i) => {
                const done = h.completedDates.includes(todayStr());
                return (
                  <TouchableOpacity
                    key={h.id}
                    activeOpacity={0.7}
                    onPress={() => toggleHabit(h)}
                    className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <View className={`w-5 h-5 rounded-md items-center justify-center border ${done ? 'bg-brand border-brand' : 'border-border'}`}>
                      {done && <Icon name="check" color="#fff" size={14} />}
                    </View>
                    <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{h.title}</Text>
                    {h.streak > 0 && (
                      <View className="flex-row items-center gap-1">
                        <Icon name="local-fire-department" size={13} color="#f97316" />
                        <Text className="text-muted text-xs font-semibold tabular-nums">{h.streak}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
