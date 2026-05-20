'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';

type Timeframe = 'short' | 'long';

interface Goal {
  id: string;
  title: string;
  progress: number;
  dueDate?: string;
  timeframe?: Timeframe;
}

const TIMEFRAME_BADGE: Record<Timeframe, string> = {
  short: 'bg-blue-500/10 text-blue-500',
  long:  'bg-brand/10 text-brand',
};

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  short: 'Short',
  long:  'Long',
};

export default function GoalCard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'goals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          progress: d.data().progress ?? 0,
          dueDate: d.data().dueDate,
          timeframe: d.data().timeframe ?? undefined,
        }))
        .filter(g => {
          const s = snap.docs.find(d => d.id === g.id)?.data().status;
          return s === 'active';
        })
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted text-sm text-center">No goals yet.<br />Ask MODUS to help you set one.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
      {goals.map(g => (
        <Link key={g.id} href={`/goals/${g.id}`} className="block group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text truncate group-hover:text-brand transition-colors">
                {g.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {g.timeframe && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIMEFRAME_BADGE[g.timeframe]}`}>
                    {TIMEFRAME_LABEL[g.timeframe]}
                  </span>
                )}
                {g.dueDate && <span className="text-xs text-muted">{g.dueDate}</span>}
              </div>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.min(100, g.progress)}%` }}
              />
            </div>
            <span className="text-xs text-muted">{g.progress}%</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
