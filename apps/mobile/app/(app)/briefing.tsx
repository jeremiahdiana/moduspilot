import { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { Skeleton } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { EmptyState } from '@/components/ui';
import { haptics } from '@/lib/haptics';

interface Top3Item { task: string; source: string }
interface BriefingHabit { name: string; streak: number; status: 'at_risk' | 'on_track' | 'done' }
interface ScheduleItem { time: string; title: string }
interface BriefingData {
  openingLine: string;
  narrative?: string;
  top3: Top3Item[];
  looseEnd: { text: string } | null;
  habits: BriefingHabit[];
  patternCallout: string | null;
  relationshipAlert: string | null;
  schedule: ScheduleItem[];
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Labeled card (icon + colored uppercase label + optional left accent bar) ──
function LabeledCard({
  icon, color, label, accent, right, children,
}: {
  icon: IconName; color: string; label: string; accent?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View
      className="bg-surface/70 border border-border/60 rounded-2xl px-5 py-4"
      style={accent ? { borderLeftWidth: 3, borderLeftColor: accent } : undefined}
    >
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Icon name={icon} size={15} color={color} />
          <Text className="text-muted text-[11px] font-bold uppercase tracking-wider">{label}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// ── Energy check ──────────────────────────────────────────────────────────────
const ENERGY_OPTS = [
  { key: 'fully_charged', label: 'Fully charged', emoji: '🔋' },
  { key: 'okay', label: 'Okay', emoji: '😐' },
  { key: 'running_low', label: 'Running low', emoji: '😴' },
];
const ENERGY_CONFIRM: Record<string, string> = {
  fully_charged: 'front-load your hardest work.',
  okay: 'pace your day around your top 3.',
  running_low: 'protect your focus — only essentials today.',
};

function HabitStatusPill({ status, streak }: { status: BriefingHabit['status']; streak: number }) {
  const map = {
    at_risk: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    done: { label: 'Done today', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    on_track: { label: `${streak} day streak`, color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  }[status];
  return (
    <View style={{ backgroundColor: map.bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: map.color }} className="text-xs font-semibold">{map.label}</Text>
    </View>
  );
}

export default function BriefingScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const [data, setData] = useState<BriefingData | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [completedTop3, setCompletedTop3] = useState<number[]>([]);
  const [customEnergy, setCustomEnergy] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) { setLoading(false); return; }
    try {
      const q = query(
        collection(db, 'users', user.uid, 'conversations'),
        orderBy('createdAt', 'desc'),
        limit(30),
      );
      const snap = await getDocs(q);
      const latest = snap.docs.find(
        d => d.data().briefing === true && d.data().deleted !== true && d.data().briefingData,
      );
      if (latest) {
        const dd = latest.data();
        const briefingData = dd.briefingData as BriefingData;
        const ts = dd.createdAt;
        const when = ts?.toDate ? ts.toDate() : new Date();
        setData(briefingData);
        setDate(when);
        setDocId(latest.id);
        setEnergy(dd.energy ?? null);
        setCompletedTop3(dd.completedTop3 ?? []);
        if (user) writeCache(`briefing.${user.uid}`, { data: briefingData, date: when.toISOString() });
      } else {
        setData(null); setDate(null); setDocId(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    readCache<{ data: BriefingData; date: string }>(`briefing.${user.uid}`).then(cached => {
      if (alive && cached) { setData(cached.data); setDate(new Date(cached.date)); setLoading(false); }
    });
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function selectEnergy(key: string) {
    if (!user || !docId) return;
    haptics.select();
    setEnergy(key);
    updateDoc(doc(db, 'users', user.uid, 'conversations', docId), { energy: key }).catch(() => {});
  }

  function toggleTop3(i: number) {
    if (!user || !docId) return;
    haptics.select();
    const next = completedTop3.includes(i) ? completedTop3.filter(x => x !== i) : [...completedTop3, i];
    setCompletedTop3(next);
    updateDoc(doc(db, 'users', user.uid, 'conversations', docId), { completedTop3: next }).catch(() => {});
  }

  const energyOpt = ENERGY_OPTS.find(o => o.key === energy);

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader title="Briefing" />

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View className="gap-2.5">
            <Skeleton width="45%" height={20} />
            <Skeleton height={13} /><Skeleton width="85%" height={13} /><Skeleton width="70%" height={13} />
          </View>
          {[0, 1, 2].map(i => (
            <View key={i} className="bg-surface/70 border border-border/60 rounded-2xl px-4 py-4 gap-2.5">
              <Skeleton width="35%" height={13} /><Skeleton height={12} /><Skeleton width="80%" height={12} />
            </View>
          ))}
        </ScrollView>
      ) : !data ? (
        <EmptyState
          icon="wb-sunny"
          title="No briefing yet"
          subtitle="MODUS generates your morning briefing automatically each day. Pull down to refresh."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.brand} />
          }
        >
          {/* Hero — narrative with brand accent bar */}
          <View className="flex-row rounded-2xl border border-brand/20 overflow-hidden">
            <View className="w-1 bg-brand" />
            <View className="flex-1 p-5">
              {date && <Text className="text-brand text-[10px] font-bold uppercase tracking-widest mb-1.5">{formatDate(date)}</Text>}
              <Text className="text-text text-base leading-6">{data.narrative ?? data.openingLine}</Text>
            </View>
          </View>

          {/* Mission today — the #1 priority, highlighted */}
          {data.top3?.[0]?.task && (
            <LinearGradient
              colors={['rgba(124,58,237,0.10)', 'rgba(124,58,237,0.03)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' }}
            >
              <View className="px-5 py-4">
                <View className="flex-row items-center gap-2 mb-1.5">
                  <Icon name="track-changes" size={15} color={c.brand} />
                  <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: c.brand }}>Mission today</Text>
                </View>
                <Text className="text-text text-[15px] font-semibold leading-snug">{data.top3[0].task}</Text>
                {!!data.top3[0].source && <Text className="text-muted text-xs mt-1">{data.top3[0].source}</Text>}
              </View>
            </LinearGradient>
          )}

          {/* Energy check */}
          <LabeledCard icon="bolt" color="#f59e0b" label="Energy check">
            {energy ? (
              <>
                <Text className="text-text text-sm font-medium mb-1">{energyOpt ? `${energyOpt.emoji} ${energyOpt.label}` : energy}</Text>
                <Text className="text-muted text-xs">MODUS will {ENERGY_CONFIRM[energy] ?? 'keep this in mind.'}</Text>
              </>
            ) : (
              <>
                <Text className="text-muted text-sm mb-3">Where are you at this morning?</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {ENERGY_OPTS.map(o => (
                    <TouchableOpacity
                      key={o.key}
                      onPress={() => selectEnergy(o.key)}
                      activeOpacity={0.7}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface"
                    >
                      <Text className="text-text text-xs">{o.emoji} {o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={customEnergy}
                  onChangeText={setCustomEnergy}
                  onSubmitEditing={() => { if (customEnergy.trim()) selectEnergy(customEnergy.trim()); }}
                  placeholder="Or type how you're feeling…"
                  placeholderTextColor={c.muted}
                  className="mt-3 text-muted text-xs"
                />
              </>
            )}
          </LabeledCard>

          {/* Top 3 — checkable */}
          {data.top3?.length > 0 && (
            <LabeledCard icon="track-changes" color="#3b82f6" label="Top 3 today">
              <View className="gap-1.5">
                {data.top3.map((item, i) => {
                  const done = completedTop3.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleTop3(i)}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2"
                    >
                      <Text className="text-[11px] font-bold w-3" style={{ color: done ? c.muted : c.brand }}>{i + 1}</Text>
                      <View
                        style={{
                          width: 18, height: 18, borderRadius: 5, borderWidth: 1.5,
                          borderColor: done ? c.brand : c.border, backgroundColor: done ? c.brand : 'transparent',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {done && <Icon name="check" color="#fff" size={12} />}
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-medium" style={[{ color: done ? c.muted : c.text }, done ? { textDecorationLine: 'line-through' } : {}]}>{item.task}</Text>
                        {!!item.source && <Text className="text-muted text-[10px] mt-0.5">{item.source}</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LabeledCard>
          )}

          {/* Schedule */}
          {data.schedule?.length > 0 && (
            <LabeledCard icon="event" color="#3b82f6" label="Today's schedule">
              <View className="gap-1.5">
                {data.schedule.map((item, i) => (
                  <View key={i} className="flex-row items-center gap-3 px-3 py-2 rounded-lg bg-surface-2">
                    <Text className="text-brand-light text-xs font-semibold w-16">{item.time}</Text>
                    <Text className="text-text text-[13px] flex-1" numberOfLines={2}>{item.title}</Text>
                  </View>
                ))}
              </View>
            </LabeledCard>
          )}

          {/* Habits */}
          {data.habits?.length > 0 && (
            <LabeledCard icon="local-fire-department" color="#f97316" label="Habits">
              <View className="gap-0.5">
                {data.habits.map((h, i) => (
                  <View key={i} className="flex-row items-center justify-between gap-3 py-2">
                    <Text className="text-text text-[14px] flex-1" numberOfLines={1}>{h.name}</Text>
                    <HabitStatusPill status={h.status} streak={h.streak} />
                  </View>
                ))}
              </View>
            </LabeledCard>
          )}

          {/* Loose end */}
          {data.looseEnd?.text && (
            <LabeledCard icon="schedule" color="#f97316" label="Loose end" accent="rgba(249,115,22,0.45)">
              <Text className="text-text text-[13px] leading-5">{data.looseEnd.text}</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/reminders' as never)}
                activeOpacity={0.7}
                className="mt-3 self-start px-2.5 py-1 rounded-lg border border-border bg-surface"
              >
                <Text className="text-muted text-[11px]">Handle now ↗</Text>
              </TouchableOpacity>
            </LabeledCard>
          )}

          {/* MODUS noticed — AI pattern observation */}
          {data.patternCallout && (
            <LabeledCard icon="visibility" color="#f59e0b" label="MODUS noticed" accent="rgba(245,158,11,0.45)">
              <Text className="text-text text-[13px] leading-5">{data.patternCallout}</Text>
            </LabeledCard>
          )}

          {/* Relationship nudge */}
          {data.relationshipAlert && (
            <LabeledCard icon="group" color="#3b82f6" label="Relationship nudge" accent="rgba(59,130,246,0.45)">
              <Text className="text-text text-[13px] leading-5">{data.relationshipAlert}</Text>
            </LabeledCard>
          )}

          {/* Ask MODUS about today */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/chat' as never)}
            activeOpacity={0.85}
            className="flex-row items-center gap-3 rounded-2xl bg-brand/5 border border-brand/25 px-5 py-4 mt-1"
          >
            <View className="w-9 h-9 rounded-xl bg-brand/15 items-center justify-center">
              <Icon name="auto-awesome" tone="brand" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-text font-semibold text-[15px]">Anything on your mind?</Text>
              <Text className="text-muted text-xs mt-0.5">Add a task, ask what you missed, or talk it through</Text>
            </View>
            <Icon name="chevron-right" tone="muted" size={20} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
