'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc,
  updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import confetti from 'canvas-confetti';
import { SkeletonList, SkeletonRow } from '@/components/ui/Skeleton';
import CalendarWidget from '@/components/dashboard/CalendarWidget';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Habit {
  id: string;
  title: string;
  description?: string;
  streak: number;
  completedDates: string[];
  frequency: 'daily' | 'weekly';
}

interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  deleted: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface GridDay {
  date: string;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITY_BAND: Record<string, string> = {
  high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-muted',
};
const PRIORITY_LABEL: Record<string, string> = {
  high: 'text-red-400', medium: 'text-yellow-400', low: 'text-muted',
};
const PRIORITY_FILTER_OPTS = ['all', 'high', 'medium', 'low'] as const;
type PriorityFilter = typeof PRIORITY_FILTER_OPTS[number];

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isOverdue(d?: string) { return d && d < localDateStr(); }

// ── Heatmap helpers ────────────────────────────────────────────────────────────

function buildWeeks(completedDates: string[]): GridDay[][] {
  const doneSet = new Set(completedDates);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayIso = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay() - 51 * 7);
  const weeks: GridDay[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 53; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isFuture = cursor > now;
      week.push({ date: dateStr, done: !isFuture && doneSet.has(dateStr), isToday: dateStr === todayIso, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function monthLabels(weeks: GridDay[][]): (string | null)[] {
  let last = -1;
  return weeks.map(w => {
    const m = new Date(w[0].date + 'T12:00:00').getMonth();
    if (m !== last) { last = m; return new Date(w[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }); }
    return null;
  });
}

function computeStats(completedDates: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const done = completedDates.filter(d => d <= today).sort();
  let best = 0, run = 0;
  let prev: Date | null = null;
  for (const d of done) {
    const curr = new Date(d + 'T12:00:00');
    if (prev) { const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000); run = diff === 1 ? run + 1 : 1; }
    else { run = 1; }
    best = Math.max(best, run);
    prev = curr;
  }
  const last7 = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }));
  const thisWeek = done.filter(d => last7.has(d)).length;
  const monthPrefix = today.slice(0, 7);
  const thisMonth = done.filter(d => d.startsWith(monthPrefix)).length;
  const dayOfMonth = new Date().getDate();
  const monthPct = dayOfMonth > 0 ? Math.round((thisMonth / dayOfMonth) * 100) : 0;
  return { bestStreak: best, thisWeek, thisMonth, monthPct, totalDone: done.length };
}

// ── Heatmap component ──────────────────────────────────────────────────────────

function Heatmap({ completedDates, onToggle }: { completedDates: string[]; onToggle: (d: string) => void }) {
  const weeks = buildWeeks(completedDates);
  const labels = monthLabels(weeks);
  const CELL = 11, GAP = 2;
  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ minWidth: weeks.length * (CELL + GAP) + 24 }}>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateColumns: `repeat(${weeks.length}, ${CELL}px)`, gap: GAP, marginLeft: 20, marginBottom: 4 }}>
          {labels.map((label, i) => (
            <div key={i} style={{ gridColumn: i + 1 }} className="text-[9px] text-muted whitespace-nowrap">{label ?? ''}</div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <div style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP, width: 16 }}>
            {['', 'M', '', 'W', '', 'F', ''].map((l, i) => (
              <div key={i} className="text-[9px] text-muted flex items-center justify-end pr-0.5">{l}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: 'column', gridAutoColumns: `${CELL}px`, gap: GAP }}>
            {weeks.flatMap(week => week.map(day => (
              <button
                key={day.date}
                title={new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (day.done ? ' ✓' : '')}
                onClick={() => !day.isFuture && onToggle(day.date)}
                disabled={day.isFuture}
                style={{ width: CELL, height: CELL }}
                className={`rounded-[2px] transition-all ${
                  day.isFuture ? 'opacity-0 cursor-default'
                  : day.isToday ? day.done ? 'bg-brand ring-1 ring-brand ring-offset-1 ring-offset-panel' : 'bg-brand/20 ring-1 ring-brand/60 ring-offset-1 ring-offset-panel'
                  : day.done ? 'bg-brand hover:bg-brand/80' : 'bg-border hover:bg-border/60 cursor-pointer'
                }`}
              />
            )))}
          </div>
        </div>
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const { user } = useAuth();
  const todayStr = localDateStr();

  // Habits state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevDoneCount = useRef(0);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [quickAdd, setQuickAdd] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  // ── Habits effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) { setHabitsLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'desc')),
      snap => {
        setHabits(snap.docs.map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          description: d.data().description,
          streak: d.data().streak ?? 0,
          completedDates: d.data().completedDates ?? [],
          frequency: d.data().frequency ?? 'daily',
        })));
        setHabitsLoading(false);
      },
      () => setHabitsLoading(false),
    );
    return unsub;
  }, [user]);

  const doneToday = habits.filter(h => h.completedDates.includes(todayStr)).length;
  const totalHabits = habits.length;
  const topStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  useEffect(() => {
    if (!habitsLoading && totalHabits > 0 && doneToday === totalHabits && prevDoneCount.current < totalHabits) {
      setShowCelebration(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#7C3AED', '#A78BFA', '#10B981', '#F59E0B'] });
      setTimeout(() => setShowCelebration(false), 3500);
    }
    prevDoneCount.current = doneToday;
  }, [doneToday, totalHabits, habitsLoading]);

  async function toggleHabit(habit: Habit, date: string) {
    if (!user) return;
    const done = habit.completedDates.includes(date);
    const newDates = done ? habit.completedDates.filter(d => d !== date) : [...habit.completedDates, date];
    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    for (const d of sorted) {
      if (d === check.toISOString().slice(0, 10)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), { completedDates: newDates, streak });
  }

  // ── Tasks effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) { setTasksLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc')),
      snap => {
        setTasks(snap.docs.map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          description: d.data().description,
          done: d.data().done ?? false,
          deleted: d.data().deleted ?? false,
          dueDate: d.data().dueDate,
          priority: d.data().priority,
        })));
        setTasksLoading(false);
      },
      () => setTasksLoading(false),
    );
    return unsub;
  }, [user]);

  async function toggleDone(task: Task) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
      done: !task.done,
      ...(task.done ? {} : { completedAt: serverTimestamp() }),
    });
  }

  async function deleteTask(task: Task) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), { deleted: true });
  }

  async function startEdit(task: Task) {
    setEditingId(task.id); setEditValue(task.title);
    setTimeout(() => editRef.current?.select(), 30);
  }

  async function saveEdit(task: Task) {
    if (!user || !editValue.trim() || editValue.trim() === task.title) { setEditingId(null); return; }
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), { title: editValue.trim() });
    setEditingId(null);
  }

  async function handleQuickAdd(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !quickAdd.trim() || !user) return;
    const title = quickAdd.trim();
    setQuickAdd('');
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      title, done: false, deleted: false, source: 'manual', createdAt: serverTimestamp(),
    });
  }

  const visibleTasks = tasks.filter(t => {
    if (t.deleted) return false;
    if (tab === 'todo' ? t.done : !t.done) return false;
    if (priorityFilter !== 'all' && tab === 'todo' && t.priority !== priorityFilter) return false;
    return true;
  });

  const overdue  = visibleTasks.filter(t => isOverdue(t.dueDate));
  const dueToday2 = visibleTasks.filter(t => t.dueDate === todayStr);
  const upcoming = visibleTasks.filter(t => t.dueDate && t.dueDate > todayStr);
  const noDate   = visibleTasks.filter(t => !t.dueDate);
  const allOverdue = tasks.filter(t => !t.deleted && !t.done && isOverdue(t.dueDate));

  const taskSections = tab === 'todo'
    ? [
        { label: 'Overdue',   tasks: overdue,   color: 'text-red-400' },
        { label: 'Due today', tasks: dueToday2, color: 'text-brand' },
        { label: 'Upcoming',  tasks: upcoming,  color: 'text-muted' },
        { label: 'No date',   tasks: noDate,    color: 'text-muted' },
      ].filter(s => s.tasks.length > 0)
    : [{ label: 'Completed', tasks: visibleTasks, color: 'text-muted' }];

  const loading = habitsLoading || tasksLoading;

  return (
    <div className="p-8 overflow-y-auto h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-text">Reminders</h1>
        <p className="text-muted text-sm mt-0.5">Habits and tasks — everything you need to show up for today.</p>

        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3"
            >
              <span className="text-xl">🎉</span>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Perfect day!</p>
                <p className="text-xs text-muted">All {totalHabits} habits complete. Keep the streak alive tomorrow.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {loading ? (
        <SkeletonList count={5} className="max-w-2xl space-y-3">
          <SkeletonRow />
        </SkeletonList>
      ) : (
        <div className="max-w-2xl space-y-10">

          {/* ── Today's schedule (calendar agenda) ──────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Today&apos;s Schedule</h2>
            </div>
            <CalendarWidget />
          </section>

          {/* ── Habits section ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Habits</h2>
                {totalHabits > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                      {doneToday}/{totalHabits} today
                    </span>
                    {topStreak > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                        {topStreak}🔥 best
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {habits.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted text-sm">No habits yet — tell MODUS what you want to build.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {habits.map((h, i) => {
                  const isDone = h.completedDates.includes(todayStr);
                  const expanded = expandedHabitId === h.id;
                  const stats = computeStats(h.completedDates);

                  return (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-panel border border-border/60 rounded-xl overflow-hidden"
                    >
                      {/* Compact row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <motion.button
                          onClick={() => toggleHabit(h, todayStr)}
                          whileTap={{ scale: 0.8 }}
                          animate={isDone ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isDone ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                          }`}
                        >
                          {isDone && (
                            <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </motion.button>

                        <button
                          onClick={() => setExpandedHabitId(expanded ? null : h.id)}
                          className="flex-1 text-left"
                        >
                          <span className={`text-sm font-medium ${isDone ? 'text-muted line-through' : 'text-text'}`}>
                            {h.title}
                          </span>
                          {h.description && (
                            <span className="text-xs text-muted ml-2">{h.description}</span>
                          )}
                        </button>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs font-semibold text-text">{h.streak}🔥</span>
                          <span className="text-xs text-muted">{stats.monthPct}% this month</span>
                          <button
                            onClick={() => setExpandedHabitId(expanded ? null : h.id)}
                            className="text-muted hover:text-text transition-colors"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded heatmap */}
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/60 px-4 pt-3 pb-4 space-y-3">
                              <div className="flex items-center gap-4 text-xs text-muted">
                                <span><span className="font-semibold text-text">{stats.bestStreak}</span> best streak</span>
                                <span><span className="font-semibold text-text">{stats.thisWeek}</span> this week</span>
                                <span><span className="font-semibold text-text">{stats.totalDone}</span> total</span>
                              </div>
                              <Heatmap completedDates={h.completedDates} onToggle={date => toggleHabit(h, date)} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <div className="border-t border-border/50" />

          {/* ── Tasks section ────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Tasks</h2>

            {/* Quick-add */}
            <div className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-panel border border-border rounded-xl focus-within:border-brand/50 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-muted shrink-0">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <input
                value={quickAdd}
                onChange={e => setQuickAdd(e.target.value)}
                onKeyDown={handleQuickAdd}
                placeholder="Add a task and press Enter…"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/50 outline-none"
              />
              {quickAdd && (
                <kbd className="text-[10px] text-muted bg-bg border border-border rounded px-1 py-0.5 font-mono shrink-0">↵</kbd>
              )}
            </div>

            {/* Tab + filter */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex gap-1 bg-panel border border-border rounded-lg p-1">
                {(['todo', 'done'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}
                  >
                    {t === 'todo' ? 'To Do' : 'Done'}
                    {t === 'todo' && allOverdue.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-semibold bg-red-500/80 text-white px-1.5 py-0.5 rounded-full">{allOverdue.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab === 'todo' && (
                <div className="flex gap-1">
                  {PRIORITY_FILTER_OPTS.map(p => (
                    <button key={p} onClick={() => setPriorityFilter(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors border ${
                        priorityFilter === p
                          ? p === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : p === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            : p === 'low' ? 'bg-border border-border text-muted'
                            : 'bg-brand/10 border-brand/30 text-brand'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {p === 'all' ? 'All' : p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {visibleTasks.length === 0 ? (
              <p className="text-muted text-sm text-center py-10">
                {tab === 'todo'
                  ? priorityFilter !== 'all' ? `No ${priorityFilter}-priority tasks.` : 'No tasks. Add one above or ask MODUS.'
                  : 'No completed tasks yet.'}
              </p>
            ) : (
              <div className="space-y-8">
                {taskSections.map(section => {
                  let idx = 0;
                  return (
                    <div key={section.label}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-semibold uppercase tracking-widest ${section.color}`}>{section.label}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-border text-muted">{section.tasks.length}</span>
                      </div>
                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {section.tasks.map(t => {
                            const i = idx++;
                            const isEditing = editingId === t.id;
                            return (
                              <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                                className="bg-panel border border-border rounded-xl flex items-stretch overflow-hidden group hover:border-brand/20 transition-colors"
                              >
                                {t.priority && <div className={`w-1 shrink-0 ${PRIORITY_BAND[t.priority] ?? 'bg-border'}`} />}
                                <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
                                  <motion.button
                                    onClick={() => toggleDone(t)}
                                    whileTap={{ scale: 0.8 }}
                                    className={`mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                                      t.done ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                                    }`}
                                  >
                                    {t.done && (
                                      <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                                        <path d="M2 6l3 3 5-5" />
                                      </svg>
                                    )}
                                  </motion.button>
                                  <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                      <input
                                        ref={editRef}
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={() => saveEdit(t)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(t); if (e.key === 'Escape') setEditingId(null); }}
                                        className="w-full bg-bg border border-brand/40 rounded px-2 py-0.5 text-sm text-text outline-none focus:border-brand transition-colors"
                                      />
                                    ) : (
                                      <p
                                        onClick={() => !t.done && startEdit(t)}
                                        className={`text-sm font-medium ${t.done ? 'line-through text-muted' : 'text-text cursor-text hover:text-brand transition-colors'}`}
                                      >
                                        {t.title}
                                      </p>
                                    )}
                                    {t.description && !isEditing && (
                                      <p className="text-xs text-muted mt-0.5 truncate">{t.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {t.priority && (
                                        <span className={`text-xs font-medium capitalize ${PRIORITY_LABEL[t.priority] ?? 'text-muted'}`}>{t.priority}</span>
                                      )}
                                      {t.dueDate && (
                                        <span className={`text-xs ${isOverdue(t.dueDate) && !t.done ? 'text-red-400 font-medium' : 'text-muted'}`}>
                                          {t.dueDate === todayStr ? 'Today' : t.dueDate}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => deleteTask(t)}
                                  className="opacity-0 group-hover:opacity-100 px-3 text-muted hover:text-red-400 transition-all shrink-0"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                  </svg>
                                </button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
