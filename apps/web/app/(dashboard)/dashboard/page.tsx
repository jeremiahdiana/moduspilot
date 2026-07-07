'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import NeedsYou from '@/components/dashboard/NeedsYou';
import { useLayoutPrefs } from '@/hooks/useLayoutPrefs';
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
    <div className="mb-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="px-5 py-4 rounded-2xl bg-brand/5 border border-brand/20 flex items-center gap-4"
      >
        <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-brand">
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
    </div>
  );
}

function StatPill({ value, label, href, color, delay = 0 }: { value: number; label: string; href: string; color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'inline-flex' }}
    >
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${color}`}
      >
        <span className="font-bold text-sm tabular-nums">{value}</span>
        <span>{label}</span>
      </Link>
    </motion.div>
  );
}

const QUICK_ACTIONS = [
  {
    label: '+ Task',
    href: '/tasks',
    color: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/15',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: '+ Goal',
    href: '/goals',
    color: 'border-brand/30 bg-brand/5 text-brand hover:bg-brand/12',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    label: '+ Log habit',
    href: '/habits',
    color: 'border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:bg-orange-500/15',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
  },
  {
    label: '+ Ask MODUS',
    href: '/chat',
    color: 'border-violet-400/30 bg-violet-500/5 text-violet-600 dark:text-violet-400 hover:bg-violet-500/12',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
] as const;

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.32 } },
} as const;
const staggerItem = {
  initial: { opacity: 0, y: 8, scale: 0.93 },
  animate: { opacity: 1, y: 0, scale: 1 },
} as const;

function QuickActions() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('modus-quick-actions');
    return saved === null ? true : saved === 'true';
  });

  const toggle = () => {
    setVisible(v => {
      const next = !v;
      localStorage.setItem('modus-quick-actions', String(next));
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="mt-4"
    >
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-[11px] text-muted/60 hover:text-muted transition-colors mb-2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3 h-3 transition-transform duration-200 ${visible ? 'rotate-0' : '-rotate-90'}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        Quick actions
      </button>

      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex items-center gap-2 flex-wrap pb-1"
            >
              {QUICK_ACTIONS.map(action => (
                <motion.div
                  key={action.href}
                  variants={staggerItem}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={action.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${action.color}`}
                  >
                    {action.icon}
                    {action.label}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const stats = useStats(user?.uid ?? null);
  const focus = useFocusTask(user?.uid ?? null);
  const { dashboardHidden } = useLayoutPrefs(user?.uid);

  return (
    <div className="overflow-y-auto h-full">
      {/* Header */}
      <div className="relative px-4 md:px-8 pt-6 md:pt-8 pb-6 border-b border-border/50 overflow-hidden">
        {/* Single faint static gradient for depth — no motion */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_0%_0%,rgba(124,58,237,0.05),transparent)] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Top row: greeting + MODUS live badge */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-medium text-text">
                {greeting()}{firstName ? (
                  <>, <span className="text-brand">{firstName}</span></>
                ) : ''}.
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-muted text-sm mt-0.5"
              >
                {today()}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20 shrink-0 mt-1"
            >
              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide">MODUS · Live</span>
            </motion.div>
          </div>

          {!dashboardHidden.has('stats') && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <StatPill value={stats.activeGoals} label="active goals" href="/goals" color="border-brand/30 bg-brand/5 text-brand" delay={0.1} />
              <StatPill value={stats.tasksDueToday} label="due today" href="/tasks" color="border-yellow-500/30 bg-yellow-500/5 text-yellow-500" delay={0.18} />
              {stats.topStreak > 0 && (
                <StatPill value={stats.topStreak} label="day streak 🔥" href="/habits" color="border-orange-500/30 bg-orange-500/5 text-orange-400" delay={0.26} />
              )}
            </div>
          )}

          {!dashboardHidden.has('quickActions') && <QuickActions />}
        </motion.div>
      </div>

      <div className="p-4 md:p-8 md:pt-6">
        <AnimatePresence>
          {focus && !dashboardHidden.has('focus') && (
            <motion.div
              key="focus"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FocusCard focus={focus} />
            </motion.div>
          )}
        </AnimatePresence>
        {!dashboardHidden.has('needsYou') && <NeedsYou />}
        <DashboardGrid hidden={dashboardHidden} />
      </div>
    </div>
  );
}
