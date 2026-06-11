import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/components/AppDrawer';
import { Icon, type IconName } from '@/components/Icon';
import { GradientText } from '@/components/ui/GradientText';
import { Logo } from '@/components/ui/Logo';
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
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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

interface Goal { id: string; title: string; progress: number; status: string; deleted?: boolean; dueDate?: string }
interface Task { id: string; title: string; done: boolean; deleted?: boolean; dueDate?: string; priority?: 'high' | 'medium' | 'low' }

const PRIORITY_DOT: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b6b80' };
interface Habit { id: string; title: string; streak: number; completedDates: string[] }
interface BriefPreview { preview: string; createdAt: Date; read: boolean }

// Web's animated headline gradient stops. The light stops are deeper violets —
// the dark-mode pastels (#a78bfa/#c084fc) wash out to near-invisible on white.
const NAME_GRADIENT_DARK = ['#7c3aed', '#a78bfa', '#c084fc', '#8b5cf6', '#7c3aed'] as const;
const NAME_GRADIENT_LIGHT = ['#6d28d9', '#7c3aed', '#9333ea', '#7c3aed', '#6d28d9'] as const;

// Accent hexes mirror web's Tailwind shades, per theme (web uses
// `text-yellow-600 dark:text-yellow-400` etc.). brand is constant both modes.
function accents(dark: boolean) {
  return dark
    ? { brand: '#7c3aed', yellow: '#facc15', orange: '#fb923c', violet: '#a78bfa', emerald: '#34d399' }
    : { brand: '#7c3aed', yellow: '#ca8a04', orange: '#ea580c', violet: '#7c3aed', emerald: '#059669' };
}
// Static tint classes (NativeWind needs literals). Light mode gets a stronger
// fill + border — /5 over white is invisible; dark keeps the subtle wash.
const TINT = {
  brand: 'bg-brand/15 dark:bg-brand/5 border-brand/40 dark:border-brand/30',
  yellow: 'bg-yellow-500/15 dark:bg-yellow-500/5 border-yellow-500/40 dark:border-yellow-500/30',
  orange: 'bg-orange-500/15 dark:bg-orange-500/5 border-orange-500/40 dark:border-orange-500/30',
  violet: 'bg-violet-500/15 dark:bg-violet-500/5 border-violet-400/40 dark:border-violet-400/30',
} as const;

// ── Colored stat pill (matches web: tinted, outlined, colored number+label) ───
function Pill({ value, label, hex, tint, onPress }: { value: number; label: string; hex: string; tint: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => { haptics.select(); onPress(); }}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${tint}`}
    >
      <Text className="font-bold text-sm tabular-nums" style={{ color: hex }}>{value}</Text>
      <Text className="text-xs font-medium" style={{ color: hex }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Colored quick-action chip (matches web) ──────────────────────────────────
function Chip({ label, icon, hex, tint, href }: { label: string; icon: IconName; hex: string; tint: string; href: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => { haptics.select(); router.push(href as never); }}
      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${tint}`}
    >
      <Icon name={icon} size={15} color={hex} />
      <Text className="font-semibold text-[13px]" style={{ color: hex }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Section card with brand-tinted medallion header (matches web Widget) ──────
function Card({ title, icon, href, children }: { title: string; icon: IconName; href?: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface dark:bg-surface/70 border border-border dark:border-border/60 rounded-2xl overflow-hidden">
      <View className="flex-row items-center justify-between px-5 py-3.5 border-b border-border dark:border-border/60">
        <View className="flex-row items-center gap-2.5">
          <View className="w-6 h-6 rounded-md bg-brand/15 dark:bg-brand/10 items-center justify-center">
            <Icon name={icon} tone="brand" size={14} />
          </View>
          <Text className="text-text font-semibold text-sm">{title}</Text>
        </View>
        {href && (
          <TouchableOpacity onPress={() => router.push(href as never)} activeOpacity={0.6}>
            <Text className="text-muted text-[11px] font-medium">View all →</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
const CardEmpty = ({ text }: { text: string }) => (
  <View className="px-4 py-5 items-center"><Text className="text-muted text-sm text-center">{text}</Text></View>
);

export default function DashboardScreen() {
  const { user } = useAuth();
  const { open } = useDrawer();
  const { colorScheme } = useColorScheme();
  const A = accents(colorScheme === 'dark');
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
          .map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', progress: d.data().progress ?? 0, status: d.data().status ?? 'active', deleted: d.data().deleted, dueDate: d.data().dueDate }))
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
          .map(d => ({ id: d.id, title: d.data().title ?? 'Untitled', done: d.data().done ?? false, deleted: d.data().deleted, dueDate: d.data().dueDate, priority: d.data().priority }))
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
        {/* Top bar — hamburger + logo + wordmark (matches web nav) */}
        <View className="flex-row items-center gap-2.5 mb-6">
          <TouchableOpacity onPress={open} activeOpacity={0.7} className="w-10 h-10 items-center justify-center rounded-xl bg-surface border border-border">
            <Icon name="menu" tone="text" size={22} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-2 bg-surface/70 border border-brand/20 rounded-2xl px-3 py-1.5">
            <Logo width={30} />
            <View>
              <Text className="text-brand font-black tracking-widest text-sm leading-none">MODUS</Text>
              <Text className="text-muted text-[8px] font-semibold uppercase tracking-widest mt-0.5">pilot</Text>
            </View>
          </View>
        </View>

        {/* Greeting + Live badge (matches web: badge to the right of greeting) */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {firstName ? (
              <>
                <Text className="text-2xl font-medium text-text">{greeting()},</Text>
                <GradientText display={false} colors={colorScheme === 'dark' ? NAME_GRADIENT_DARK : NAME_GRADIENT_LIGHT} className="text-2xl font-medium">{`${firstName}.`}</GradientText>
              </>
            ) : (
              <Text className="text-2xl font-medium text-text">{greeting()}.</Text>
            )}
          </View>
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 dark:border-emerald-500/20 mt-1">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-[10px] font-semibold tracking-wide" style={{ color: A.emerald }}>MODUS · Live</Text>
          </View>
        </View>
        <Text className="text-muted text-sm mt-1">{todayLabel()}</Text>

        {/* Colored stat pills */}
        <View className="flex-row items-center flex-wrap gap-2 mt-3.5">
          <Pill value={goals.length} label="active goals" hex={A.brand} tint={TINT.brand} onPress={() => router.push('/(app)/goals' as never)} />
          <Pill value={dueToday.length} label="due today" hex={A.yellow} tint={TINT.yellow} onPress={() => router.push('/(app)/reminders' as never)} />
          {topStreak > 0 && (
            <Pill value={topStreak} label="day streak" hex={A.orange} tint={TINT.orange} onPress={() => router.push('/(app)/reminders' as never)} />
          )}
          {inbox.length > 0 && (
            <Pill value={inbox.length} label="unread" hex={A.violet} tint={TINT.violet} onPress={() => router.push('/(app)/briefing' as never)} />
          )}
        </View>

        {/* Quick actions */}
        <Text className="text-muted/70 text-[11px] mt-5 mb-2">Quick actions</Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip label="+ Task" icon="add-task" hex={A.yellow} tint={TINT.yellow} href="/(app)/reminders" />
          <Chip label="+ Goal" icon="flag" hex={A.brand} tint={TINT.brand} href="/(app)/goals" />
          <Chip label="+ Log habit" icon="local-fire-department" hex={A.orange} tint={TINT.orange} href="/(app)/reminders" />
          <Chip label="+ Ask MODUS" icon="auto-awesome" hex={A.violet} tint={TINT.violet} href="/(app)/chat" />
        </View>

        {/* Focus card — brand-tinted with medallion (matches web) */}
        {focus && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push((focus.source === 'briefing' ? '/(app)/briefing' : '/(app)/reminders') as never)}
            className="flex-row items-center gap-4 mt-5 rounded-2xl bg-brand/10 dark:bg-brand/5 border border-brand/30 dark:border-brand/25 px-5 py-4"
          >
            <View className="w-9 h-9 rounded-xl bg-brand/20 dark:bg-brand/15 items-center justify-center">
              <Icon name="track-changes" tone="brand" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-brand/70 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
                {focus.source === 'briefing' ? 'Your focus today' : 'Up next'}
              </Text>
              <Text className="text-text font-semibold text-sm leading-5" numberOfLines={2}>{focus.title}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Sections */}
        <View className="gap-4 mt-6">
          {/* Today's schedule */}
          <Card title="Today's schedule" icon="event" href="/(app)/briefing">
            {events.length === 0 ? (
              <CardEmpty text={googleConnected ? 'Nothing scheduled today.' : 'Connect Google in chat to see your schedule.'} />
            ) : (
              events.slice(0, 5).map((e, i) => (
                <View key={e.id} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Text className="text-brand font-semibold text-xs tabular-nums w-16">{fmtTime(e.start)}</Text>
                  <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{e.title}</Text>
                </View>
              ))
            )}
          </Card>

          {/* Today's briefing */}
          <Card title="Today's briefing" icon="notifications" href="/(app)/briefing">
            {!brief ? (
              <CardEmpty text="No briefings yet. They arrive at your scheduled time." />
            ) : (
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(app)/briefing' as never)} className="px-4 py-3.5">
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
          </Card>

          {/* Inbox */}
          {(inbox.length > 0 || !googleConnected) && (
            <Card title="Inbox" icon="mail-outline" href="/(app)/briefing">
              {inbox.length === 0 ? (
                <CardEmpty text="Connect Google in chat to see your inbox." />
              ) : (
                inbox.slice(0, 4).map((t, i) => (
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
                ))
              )}
            </Card>
          )}

          {/* Goals */}
          <Card title="Goals" icon="flag" href="/(app)/goals">
            {topGoals.length === 0 ? (
              <CardEmpty text="No active goals. Ask MODUS to set one." />
            ) : (
              topGoals.map((g, i) => (
                <TouchableOpacity
                  key={g.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(app)/goal/${g.id}` as never)}
                  className={`px-4 py-3.5 gap-2.5 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-text font-medium text-[15px] flex-1" numberOfLines={1}>{g.title}</Text>
                    {g.dueDate ? <Text className="text-muted text-[11px]">{g.dueDate}</Text> : null}
                    <Text className="text-muted text-xs font-semibold tabular-nums">{g.progress}%</Text>
                  </View>
                  <View className="h-1 rounded-full bg-surface-2 overflow-hidden">
                    <View className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, g.progress))}%` }} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>

          {/* Due today */}
          <Card title="Due today" icon="check-box" href="/(app)/reminders">
            {dueToday.length === 0 ? (
              <CardEmpty text="Nothing due today. You're clear." />
            ) : (
              dueToday.slice(0, 4).map((t, i) => (
                <TouchableOpacity
                  key={t.id}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(app)/reminders' as never)}
                  className={`px-4 py-3.5 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <Icon name="radio-button-unchecked" tone="muted" size={19} />
                  <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{t.title}</Text>
                  {t.priority && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIORITY_DOT[t.priority] }} />}
                </TouchableOpacity>
              ))
            )}
          </Card>

          {/* Habits — tap to check in */}
          {habits.length > 0 && (
            <Card title="Habits" icon="autorenew" href="/(app)/reminders">
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
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
