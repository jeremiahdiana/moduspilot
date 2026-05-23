'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import Link from 'next/link';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Stats {
  activeGoals: number;
  tasksDueToday: number;
  topStreak: number;
}

function useStats(uid: string | null): Stats {
  const [stats, setStats] = useState<Stats>({ activeGoals: 0, tasksDueToday: 0, topStreak: 0 });

  useEffect(() => {
    if (!uid) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    const unsubGoals = onSnapshot(
      query(collection(db, 'users', uid, 'goals'), where('status', '==', 'active')),
      snap => setStats(s => ({ ...s, activeGoals: snap.size })),
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'users', uid, 'tasks'), where('done', '==', false), where('dueDate', '==', todayStr)),
      snap => setStats(s => ({ ...s, tasksDueToday: snap.size })),
    );

    const unsubHabits = onSnapshot(
      query(collection(db, 'users', uid, 'habits'), orderBy('streak', 'desc')),
      snap => {
        const top = snap.docs[0]?.data()?.streak ?? 0;
        setStats(s => ({ ...s, topStreak: top }));
      },
    );

    return () => { unsubGoals(); unsubTasks(); unsubHabits(); };
  }, [uid]);

  return stats;
}

function useFocusTask(uid: string | null) {
  const [focus, setFocus] = useState<{ title: string; source: 'briefing' | 'task' } | null>(null);

  useEffect(() => {
    if (!uid) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Try today's briefing first (top3[0])
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const unsubBriefing = onSnapshot(
      query(
        collection(db, 'users', uid, 'conversations'),
        where('briefing', '==', true),
        orderBy('createdAt', 'desc'),
        limit(1),
      ),
      snap => {
        const doc = snap.docs[0];
        if (!doc) return;
        const top3 = doc.data().briefingData?.top3 ?? [];
        const createdAt = doc.data().createdAt?.toDate?.() ?? new Date(0);
        if (top3[0]?.task && createdAt >= todayStart) {
          setFocus({ title: top3[0].task, source: 'briefing' });
          return;
        }
        // Fall back to most urgent task due today
        onSnapshot(
          query(collection(db, 'users', uid, 'tasks'), where('done', '==', false), where('dueDate', '==', todayStr), limit(1)),
          tSnap => {
            const t = tSnap.docs[0];
            if (t) setFocus({ title: t.data().title, source: 'task' });
          },
          () => {},
        );
      },
      () => {},
    );
    return unsubBriefing;
  }, [uid]);

  return focus;
}

function FocusCard({ focus }: { focus: { title: string; source: 'briefing' | 'task' } }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      className="mb-5 px-5 py-4 rounded-2xl bg-brand/5 border border-brand/20 flex items-center gap-4"
    >
      <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-brand w-[18px] h-[18px]">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand/70 mb-0.5">
          {focus.source === 'briefing' ? 'Your focus today' : 'Up next'}
        </p>
        <p className="text-sm font-semibold text-text truncate">{focus.title}</p>
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  const start = useRef<number>(0);
  const from = useRef<number>(0);

  useEffect(() => {
    from.current = display;
    start.current = 0;
    cancelAnimationFrame(raf.current);

    const step = (ts: number) => {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from.current + (target - from.current) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

function StatPill({ value, label, href, color, delay = 0 }: { value: number; label: string; href: string; color: string; delay?: number }) {
  const count = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:opacity-80 ${color}`}
      >
        <span className="font-bold text-sm">{count}</span>
        <span>{label}</span>
      </Link>
    </motion.div>
  );
}

const QUICK_ACTIONS = [
  {
    label: '+ Task',
    href: '/tasks',
    color: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: '+ Goal',
    href: '/goals',
    color: 'border-brand/30 bg-brand/5 text-brand hover:bg-brand/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    label: '+ Log habit',
    href: '/habits',
    color: 'border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
  },
  {
    label: '+ Ask MODUS',
    href: '/chat',
    color: 'border-violet-400/30 bg-violet-500/5 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
] as const;

function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="flex items-center gap-2 mt-4 flex-wrap"
    >
      {QUICK_ACTIONS.map(action => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${action.color}`}
        >
          {action.icon}
          {action.label}
        </Link>
      ))}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const stats = useStats(user?.uid ?? null);
  const focus = useFocusTask(user?.uid ?? null);

  return (
    <div className="p-8 overflow-y-auto h-full">
      <motion.div
        className="mb-7"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-bold text-text">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-muted text-sm mt-0.5">{today()}</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <StatPill value={stats.activeGoals} label="active goals" href="/goals" color="border-brand/30 bg-brand/5 text-brand" delay={0.1} />
          <StatPill value={stats.tasksDueToday} label="due today" href="/tasks" color="border-yellow-500/30 bg-yellow-500/5 text-yellow-500" delay={0.2} />
          {stats.topStreak > 0 && (
            <StatPill value={stats.topStreak} label="day streak 🔥" href="/habits" color="border-orange-500/30 bg-orange-500/5 text-orange-400" delay={0.3} />
          )}
        </div>

        <QuickActions />
      </motion.div>

      {focus && <FocusCard focus={focus} />}
      <DashboardGrid />
    </div>
  );
}
