'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const stats = useStats(user?.uid ?? null);

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
      </motion.div>

      <DashboardGrid />
    </div>
  );
}
