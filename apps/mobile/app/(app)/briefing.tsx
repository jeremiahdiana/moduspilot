import { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemeColors } from '@/lib/theme';
import { Skeleton } from '@/components/Skeleton';
import { readCache, writeCache } from '@/lib/cache';
import { EmptyState } from '@/components/ui';

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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2.5 mt-1">{children}</Text>
  );
}

function HabitStatusPill({ status, streak }: { status: BriefingHabit['status']; streak: number }) {
  const map = {
    at_risk: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    done: { label: 'Done today', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    on_track: { label: `${streak} day streak`, color: '#9461ff', bg: 'rgba(148,97,255,0.14)' },
  }[status];
  return (
    <View style={{ backgroundColor: map.bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: map.color }} className="text-xs font-semibold">{map.label}</Text>
    </View>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-surface border border-border rounded-xl px-4 py-4">{children}</View>
);

export default function BriefingScreen() {
  const { user } = useAuth();
  const c = useThemeColors();
  const [data, setData] = useState<BriefingData | null>(null);
  const [date, setDate] = useState<Date | null>(null);
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
        const briefingData = latest.data().briefingData as BriefingData;
        const ts = latest.data().createdAt;
        const when = ts?.toDate ? ts.toDate() : new Date();
        setData(briefingData);
        setDate(when);
        if (user) writeCache(`briefing.${user.uid}`, { data: briefingData, date: when.toISOString() });
      } else {
        setData(null);
        setDate(null);
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
    // Paint last-known briefing instantly while load() revalidates.
    readCache<{ data: BriefingData; date: string }>(`briefing.${user.uid}`).then(cached => {
      if (alive && cached) { setData(cached.data); setDate(new Date(cached.date)); setLoading(false); }
    });
    load();
    return () => { alive = false; };
  }, [user]);

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScreenHeader title="Briefing" />

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Narrative */}
          <View className="gap-2.5">
            <Skeleton width="45%" height={20} />
            <Skeleton height={13} />
            <Skeleton width="85%" height={13} />
            <Skeleton width="70%" height={13} />
          </View>
          {/* Cards */}
          {[0, 1, 2].map(i => (
            <View key={i} className="bg-surface border border-border rounded-2xl px-4 py-4 gap-2.5">
              <Skeleton width="35%" height={13} />
              <Skeleton height={12} />
              <Skeleton width="80%" height={12} />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.brand} />
          }
        >
          {/* Hero — flat card with a thin brand accent bar */}
          <View className="flex-row rounded-xl border border-border bg-surface overflow-hidden mb-1">
            <View className="w-1 bg-brand" />
            <View className="flex-1 p-5">
              {date && <Text className="text-brand text-[10px] font-bold uppercase tracking-widest mb-1.5">{formatDate(date)}</Text>}
              <Text className="text-text text-base leading-6">{data.narrative ?? data.openingLine}</Text>
            </View>
          </View>

          {data.top3?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Top 3 for today</SectionLabel>
              <View className="bg-surface border border-border rounded-xl px-4 py-2">
                {data.top3.map((item, i) => (
                  <View key={i} className={`flex-row items-start gap-3 py-3 ${i < data.top3.length - 1 ? 'border-b border-border' : ''}`}>
                    <View
                      className="bg-brand"
                      style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                    >
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-text text-[15px] font-medium leading-5">{item.task}</Text>
                      {!!item.source && <Text className="text-muted text-xs mt-0.5">{item.source}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.schedule?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Today</SectionLabel>
              <View className="bg-surface border border-border rounded-xl px-4 py-2">
                {data.schedule.map((item, i) => (
                  <View key={i} className={`flex-row items-center gap-3 py-3 ${i < data.schedule.length - 1 ? 'border-b border-border' : ''}`}>
                    <Text className="text-brand-light text-xs font-semibold w-16">{item.time}</Text>
                    <Text className="text-text text-[15px] flex-1" numberOfLines={2}>{item.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.habits?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Habits</SectionLabel>
              <View className="bg-surface border border-border rounded-xl px-4 py-2">
                {data.habits.map((h, i) => (
                  <View key={i} className={`flex-row items-center justify-between gap-3 py-3 ${i < data.habits.length - 1 ? 'border-b border-border' : ''}`}>
                    <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{h.name}</Text>
                    <HabitStatusPill status={h.status} streak={h.streak} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.looseEnd?.text && (
            <View className="mt-3">
              <SectionLabel>Loose end</SectionLabel>
              <Card><Text className="text-text text-[15px] leading-6">{data.looseEnd.text}</Text></Card>
            </View>
          )}

          {data.patternCallout && (
            <View className="mt-3">
              <SectionLabel>Pattern</SectionLabel>
              <Card><Text className="text-text text-[15px] leading-6">{data.patternCallout}</Text></Card>
            </View>
          )}

          {data.relationshipAlert && (
            <View className="mt-3">
              <SectionLabel>Heads up</SectionLabel>
              <Card><Text className="text-text text-[15px] leading-6">{data.relationshipAlert}</Text></Card>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
