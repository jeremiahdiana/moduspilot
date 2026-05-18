'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: 'active' | 'completed';
  dueDate?: string;
}

export default function GoalCard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'goals'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          description: d.data().description,
          progress: d.data().progress ?? 0,
          status: d.data().status ?? 'active',
          dueDate: d.data().dueDate,
        }))
        .filter(g => g.status === 'active')
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  return (
    <div className="h-full flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-sm text-center">No goals yet.<br />Ask MODUS to help you set one.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {goals.map(g => (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text truncate">{g.title}</span>
                {g.dueDate && (
                  <span className="text-xs text-muted shrink-0">{g.dueDate}</span>
                )}
              </div>
              {g.description && (
                <p className="text-xs text-muted truncate">{g.description}</p>
              )}
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, g.progress)}%` }}
                />
              </div>
              <span className="text-xs text-muted">{g.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
