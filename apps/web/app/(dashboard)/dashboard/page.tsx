'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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

function StatPill({ value, label, href, color }: { value: number; label: string; href: string; color: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:opacity-80 ${color}`}
    >
      <span className="font-bold text-sm">{value}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const stats = useStats(user?.uid ?? null);

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-text">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-muted text-sm mt-0.5">{today()}</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <StatPill
            value={stats.activeGoals}
            label="active goals"
            href="/goals"
            color="border-brand/30 bg-brand/5 text-brand"
          />
          <StatPill
            value={stats.tasksDueToday}
            label="due today"
            href="/tasks"
            color="border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
          />
          {stats.topStreak > 0 && (
            <StatPill
              value={stats.topStreak}
              label="day streak 🔥"
              href="/habits"
              color="border-orange-500/30 bg-orange-500/5 text-orange-400"
            />
          )}
        </div>
      </div>

      <DashboardGrid />
    </div>
  );
}
