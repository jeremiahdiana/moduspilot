'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { motion } from 'framer-motion';

interface Habit {
  id: string;
  title: string;
  description?: string;
  streak: number;
  completedDates: string[];
  frequency: 'daily' | 'weekly';
}

interface GridDay {
  date: string;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
}

// Build 52 weeks × 7 days, starting from the Sunday 51 weeks ago
function buildWeeks(completedDates: string[]): GridDay[][] {
  const doneSet = new Set(completedDates);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = now.toISOString().slice(0, 10);

  // Rewind to Sunday 51 full weeks before current week's Sunday
  const startSunday = new Date(now);
  startSunday.setDate(startSunday.getDate() - startSunday.getDay() - 51 * 7);

  const weeks: GridDay[][] = [];
  const cursor = new Date(startSunday);

  for (let w = 0; w < 53; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isFuture = cursor > now;
      week.push({
        date: dateStr,
        done: !isFuture && doneSet.has(dateStr),
        isToday: dateStr === todayStr,
        isFuture,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function monthLabels(weeks: GridDay[][]): (string | null)[] {
  let lastMonth = -1;
  return weeks.map(week => {
    const month = new Date(week[0].date + 'T12:00:00').getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      return new Date(week[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
    }
    return null;
  });
}

function computeStats(completedDates: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const done = completedDates.filter(d => d <= today).sort();
  const totalDone = done.length;

  // Best streak
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of done) {
    const curr = new Date(d + 'T12:00:00');
    if (prev) {
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = curr;
  }

  // This week (last 7 days)
  const last7 = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    }),
  );
  const thisWeek = done.filter(d => last7.has(d)).length;

  // This month
  const monthPrefix = today.slice(0, 7);
  const thisMonth = done.filter(d => d.startsWith(monthPrefix)).length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const monthPct = dayOfMonth > 0 ? Math.round((thisMonth / dayOfMonth) * 100) : 0;

  return { totalDone, bestStreak: best, thisWeek, thisMonth, monthPct };
}

// Cell tooltip-friendly date format
function fmtDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

interface HeatmapProps {
  completedDates: string[];
  onToggle: (date: string) => void;
}

function Heatmap({ completedDates, onToggle }: HeatmapProps) {
  const weeks = buildWeeks(completedDates);
  const labels = monthLabels(weeks);
  const CELL = 11;
  const GAP = 2;

  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ minWidth: weeks.length * (CELL + GAP) + 24 }}>
        {/* Month labels */}
        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridTemplateColumns: `repeat(${weeks.length}, ${CELL}px)`,
            gap: GAP,
            marginLeft: 20,
            marginBottom: 4,
          }}
        >
          {labels.map((label, i) => (
            <div key={i} style={{ gridColumn: i + 1 }} className="text-[9px] text-muted whitespace-nowrap">
              {label ?? ''}
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          {/* Day-of-week labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gap: GAP,
              width: 16,
            }}
          >
            {['', 'M', '', 'W', '', 'F', ''].map((label, i) => (
              <div key={i} className="text-[9px] text-muted flex items-center justify-end pr-0.5">
                {label}
              </div>
            ))}
          </div>

          {/* Cell grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoFlow: 'column',
              gridAutoColumns: `${CELL}px`,
              gap: GAP,
            }}
          >
            {weeks.flatMap(week =>
              week.map(day => (
                <button
                  key={day.date}
                  title={`${fmtDate(day.date)}${day.done ? ' ✓' : ''}`}
                  onClick={() => !day.isFuture && onToggle(day.date)}
                  disabled={day.isFuture}
                  style={{ width: CELL, height: CELL }}
                  className={`rounded-[2px] transition-all ${
                    day.isFuture
                      ? 'opacity-0 cursor-default'
                      : day.isToday
                      ? day.done
                        ? 'bg-brand ring-1 ring-brand ring-offset-1 ring-offset-panel'
                        : 'bg-brand/20 ring-1 ring-brand/60 ring-offset-1 ring-offset-panel'
                      : day.done
                      ? 'bg-brand hover:bg-brand/80'
                      : 'bg-border hover:bg-border/60 cursor-pointer'
                  }`}
                />
              )),
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 ml-5">
          <span className="text-[9px] text-muted">Less</span>
          {['bg-border', 'bg-brand/30', 'bg-brand/60', 'bg-brand'].map((cls, i) => (
            <div key={i} style={{ width: CELL, height: CELL }} className={`rounded-[2px] ${cls}`} />
          ))}
          <span className="text-[9px] text-muted">More</span>
        </div>
      </div>
    </div>
  );
}

export default function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setHabits(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        streak: d.data().streak ?? 0,
        completedDates: d.data().completedDates ?? [],
        frequency: d.data().frequency ?? 'daily',
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function toggleDate(habit: Habit, date: string) {
    if (!user) return;
    const done = habit.completedDates.includes(date);
    const newDates = done
      ? habit.completedDates.filter(d => d !== date)
      : [...habit.completedDates, date];

    // Recalculate current streak from today backward
    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    for (const d of sorted) {
      if (d === check.toISOString().slice(0, 10)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), { completedDates: newDates, streak });
  }

  // Overall stats across all habits
  const totalHabits = habits.length;
  const doneToday = habits.filter(h => h.completedDates.includes(today)).length;
  const topStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  return (
    <div className="p-8 overflow-y-auto h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-text">Habits</h1>
        <p className="text-muted text-sm mt-0.5">Build consistency, one day at a time.</p>

        {totalHabits > 0 && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand/30 bg-brand/5 text-xs font-medium text-brand">
              <span className="font-bold">{doneToday}/{totalHabits}</span>
              <span>done today</span>
            </div>
            {topStreak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/5 text-xs font-medium text-orange-400">
                <span className="font-bold">{topStreak}</span>
                <span>day best streak 🔥</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted">
              <span className="font-bold">{totalHabits}</span>
              <span>active habit{totalHabits !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-panel border border-border flex items-center justify-center text-2xl">
            🔥
          </div>
          <p className="text-text font-medium">No habits yet</p>
          <p className="text-muted text-sm text-center max-w-xs">
            Tell MODUS what you want to build — a morning routine, a workout cadence, anything.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          {habits.map((h, i) => {
            const doneToday = h.completedDates.includes(today);
            const stats = computeStats(h.completedDates);

            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="bg-panel border border-border/60 rounded-2xl p-5 space-y-4"
              >
                {/* Card header */}
                <div className="flex items-start gap-3">
                  <motion.button
                    onClick={() => toggleDate(h, today)}
                    whileTap={{ scale: 0.8 }}
                    animate={doneToday ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                      doneToday ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                    }`}
                  >
                    {doneToday && (
                      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </motion.button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text">{h.title}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-border/60 text-muted capitalize">
                        {h.frequency}
                      </span>
                    </div>
                    {h.description && (
                      <p className="text-xs text-muted mt-0.5">{h.description}</p>
                    )}
                  </div>

                  {/* Streak + mini stats */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div className="text-right">
                      <p className="text-sm font-bold text-text">{h.streak}🔥</p>
                      <p className="text-[10px] text-muted">streak</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-text">{stats.monthPct}%</p>
                      <p className="text-[10px] text-muted">this month</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-text">{stats.totalDone}</p>
                      <p className="text-[10px] text-muted">total</p>
                    </div>
                  </div>
                </div>

                {/* Heatmap */}
                <Heatmap
                  completedDates={h.completedDates}
                  onToggle={date => toggleDate(h, date)}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
