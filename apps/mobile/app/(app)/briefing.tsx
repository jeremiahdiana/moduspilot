import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

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
    <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2.5 mt-1">
      {children}
    </Text>
  );
}

function HabitStatusPill({ status, streak }: { status: BriefingHabit['status']; streak: number }) {
  const map = {
    at_risk: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    done: { label: 'Done today', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    on_track: { label: `${streak} day streak`, color: '#9461ff', bg: 'rgba(148,97,255,0.12)' },
  }[status];
  return (
    <View style={{ backgroundColor: map.bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: map.color }} className="text-xs font-semibold">{map.label}</Text>
    </View>
  );
}

export default function BriefingScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<BriefingData | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) { setLoading(false); return; }
    try {
      // Single orderBy + client-side filter (no composite index in this project).
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
        setData(latest.data().briefingData as BriefingData);
        const ts = latest.data().createdAt;
        setDate(ts?.toDate ? ts.toDate() : new Date());
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

  useEffect(() => { load(); }, [user]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-5 py-3 border-b border-border">
        <Text className="text-xl font-black text-text">Briefing</Text>
        {date && <Text className="text-muted text-sm mt-0.5">{formatDate(date)}</Text>}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : !data ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text className="text-4xl">☀️</Text>
          <Text className="text-text font-semibold text-base">No briefing yet</Text>
          <Text className="text-muted text-sm text-center">
            MODUS generates your morning briefing automatically each day. Pull down to refresh.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#7C3AED"
            />
          }
        >
          {/* Narrative */}
          <View className="bg-surface rounded-2xl px-4 py-4">
            <Text className="text-text text-base leading-6">
              {data.narrative ?? data.openingLine}
            </Text>
          </View>

          {/* Top 3 */}
          {data.top3?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Top 3 for today</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-2">
                {data.top3.map((item, i) => (
                  <View
                    key={i}
                    className={`flex-row items-start gap-3 py-3 ${i < data.top3.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <View className="w-6 h-6 rounded-full bg-surface-2 items-center justify-center mt-0.5">
                      <Text className="text-brand-light text-xs font-bold">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-text text-[15px] font-medium leading-5">{item.task}</Text>
                      {!!item.source && (
                        <Text className="text-muted text-xs mt-0.5">{item.source}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Schedule */}
          {data.schedule?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Today</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-2">
                {data.schedule.map((item, i) => (
                  <View
                    key={i}
                    className={`flex-row items-center gap-3 py-3 ${i < data.schedule.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <Text className="text-brand-light text-xs font-semibold w-16">{item.time}</Text>
                    <Text className="text-text text-[15px] flex-1" numberOfLines={2}>{item.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Habits */}
          {data.habits?.length > 0 && (
            <View className="mt-3">
              <SectionLabel>Habits</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-2">
                {data.habits.map((h, i) => (
                  <View
                    key={i}
                    className={`flex-row items-center justify-between gap-3 py-3 ${i < data.habits.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{h.name}</Text>
                    <HabitStatusPill status={h.status} streak={h.streak} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Loose end */}
          {data.looseEnd?.text && (
            <View className="mt-3">
              <SectionLabel>Loose end</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-4">
                <Text className="text-text text-[15px] leading-6">{data.looseEnd.text}</Text>
              </View>
            </View>
          )}

          {/* Pattern */}
          {data.patternCallout && (
            <View className="mt-3">
              <SectionLabel>Pattern</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-4">
                <Text className="text-text text-[15px] leading-6">{data.patternCallout}</Text>
              </View>
            </View>
          )}

          {/* Relationship alert */}
          {data.relationshipAlert && (
            <View className="mt-3">
              <SectionLabel>Heads up</SectionLabel>
              <View className="bg-surface rounded-2xl px-4 py-4">
                <Text className="text-text text-[15px] leading-6">{data.relationshipAlert}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
