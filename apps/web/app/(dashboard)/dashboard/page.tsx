'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import NeedsYou from '@/components/dashboard/NeedsYou';
import BriefingHero from '@/components/dashboard/BriefingHero';
import { useLayoutPrefs } from '@/hooks/useLayoutPrefs';
import { localDateStr } from '@/lib/dates';
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

function useFocusTask(uid: string | null) {
  const [focus, setFocus] = useState<{ title: string; source: 'briefing' | 'task' } | null>(null);

  useEffect(() => {
    if (!uid) return;
    const todayStr = localDateStr();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    let unsubTasks: (() => void) | undefined;

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
        // Replace (never stack) the fallback task listener — this callback can
        // fire many times, and the old code leaked a new listener each time.
        unsubTasks?.();
        unsubTasks = onSnapshot(
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
    return () => { unsubBriefing(); unsubTasks?.(); };
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

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? '';
  const focus = useFocusTask(user?.uid ?? null);
  const { dashboardHidden, briefingEnabled } = useLayoutPrefs(user?.uid);
  const showBriefingHero = !dashboardHidden.has('briefing') && briefingEnabled;

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
          {/* Greeting only. The "MODUS · Live" badge, the stat pills and the
              Quick actions row were removed 2026-08-04 — the dashboard opens on
              the briefing, and three competing clusters of chrome above it were
              noise, not navigation. */}
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

        </motion.div>
      </div>

      <div className="p-4 md:p-8 md:pt-6">
        {showBriefingHero && <BriefingHero />}
        <AnimatePresence>
          {/* The briefing hero owns the "your focus today" (briefing top priority);
              only show the standalone Focus card for a plain next task, so the same
              item never appears twice. */}
          {focus && focus.source === 'task' && !dashboardHidden.has('focus') && (
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
