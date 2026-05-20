'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';

interface LatestBriefing {
  id: string;
  title: string;
  preview: string;
  createdAt: Date;
  read: boolean;
}

export default function BriefingWidget() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [briefing, setBriefing] = useState<LatestBriefing | null>(null);
  const [loading, setLoading] = useState(true);

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
      setBriefing({
        id: d.id,
        title: d.data().title ?? 'Morning Briefing',
        preview: d.data().messages?.[0]?.content ?? '',
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        read: d.data().read ?? false,
      });
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-1">
        <p className="text-xs text-muted">No briefings yet.</p>
        <p className="text-xs text-muted">They arrive at your scheduled time.</p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = briefing.createdAt >= today;

  return (
    <Link href="/briefing" className="flex flex-col h-full group">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        {!briefing.read && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
        )}
        <p className="text-[11px] text-muted">
          {isToday
            ? 'Today'
            : briefing.createdAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>
      <p className="text-sm text-text line-clamp-5 flex-1">{briefing.preview}</p>
      <p className="text-xs text-brand pt-2 shrink-0 group-hover:underline">Read full briefing →</p>
    </Link>
  );
}
