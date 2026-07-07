'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Skeleton } from '@/components/ui/Skeleton';
import type { BriefingData } from '@/lib/briefing';

interface LatestBriefing {
  id: string;
  briefingData: BriefingData | null;
  content: string;
  createdAt: Date;
  read: boolean;
}

function fmtHeader(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isToday(d: Date) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d >= t;
}

// Top-of-dashboard morning briefing. Surfaces the latest generated briefing so
// the dashboard is the single "Today" home — the full interactive briefing
// (chat / energy / listen / history) lives at /briefing, reached via the link
// below or ⌘K. Reads only fields that already exist on briefingData; never
// fabricates counts.
export default function BriefingHero() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [briefing, setBriefing] = useState<LatestBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', uid, 'conversations'),
      where('briefing', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) { setBriefing(null); setLoading(false); return; }
      const d = snap.docs[0];
      const data = d.data();
      const b: LatestBriefing = {
        id: d.id,
        briefingData: (data.briefingData as BriefingData) ?? null,
        content: (data.messages?.[0]?.content as string) ?? '',
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
        read: data.read ?? false,
      };
      setBriefing(b);
      // Auto-expand an unread briefing (the "morning" moment); collapse once read.
      setExpanded(!b.read);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  if (loading) {
    return (
      <div className="mb-5 px-5 py-4 rounded-2xl bg-panel border border-border/60">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-4 w-2/3 mb-2" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  if (!briefing) return null;

  const data = briefing.briefingData;
  const today = isToday(briefing.createdAt);
  const lede = data?.narrative ?? data?.openingLine ?? briefing.content.slice(0, 200);
  const top = data?.top3?.[0];
  const priorities = data?.top3?.length ?? 0;
  const events = data?.schedule?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5 rounded-2xl bg-brand/5 border border-brand/20 overflow-hidden"
    >
      {/* Header row — always visible, doubles as the collapse toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 group"
      >
        <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-brand">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand/70">
              {today ? 'Morning briefing' : 'Latest briefing'}
            </p>
            {!briefing.read && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
            <span className="text-[11px] text-muted">· {fmtHeader(briefing.createdAt)}</span>
          </div>
          {/* Collapsed: show the single top priority. Expanded: show the lede. */}
          {!expanded && top ? (
            <p className="text-sm font-semibold text-text truncate mt-1">{top.task}</p>
          ) : (
            <p className="text-sm text-text/80 leading-relaxed mt-1 line-clamp-2">{lede}</p>
          )}
        </div>

        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className={`w-4 h-4 shrink-0 text-muted mt-1.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[72px]">
              {/* Top 3 priorities */}
              {data?.top3 && data.top3.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                  {data.top3.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="w-4 h-4 rounded-full bg-brand/15 text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="text-text">{item.task}</span>
                        {item.source && <span className="text-muted text-xs"> · {item.source}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                {priorities > 0 && (
                  <span className="text-[11px] text-muted">{priorities} priorit{priorities === 1 ? 'y' : 'ies'}</span>
                )}
                {events > 0 && (
                  <span className="text-[11px] text-muted">· {events} event{events === 1 ? '' : 's'}</span>
                )}
                <Link
                  href="/briefing"
                  className="text-xs font-medium text-brand hover:underline ml-auto"
                >
                  Open full briefing →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
