'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
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

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'goals'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        progress: d.data().progress ?? 0,
        status: d.data().status ?? 'active',
        dueDate: d.data().dueDate,
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function markComplete(goalId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), {
      status: 'completed',
      progress: 100,
    });
  }

  async function reopen(goalId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), { status: 'active' });
  }

  const filtered = goals.filter(g => g.status === tab);

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Goals</h1>
        <p className="text-muted text-sm mt-1">Track what you&apos;re working toward.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
        {(['active', 'completed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm">
            {tab === 'active'
              ? 'No active goals. Tell MODUS what you want to achieve.'
              : 'No completed goals yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {filtered.map(g => (
            <div key={g.id} className="bg-panel border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="font-semibold text-text">{g.title}</p>
                  {g.description && <p className="text-sm text-muted mt-0.5">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.dueDate && <span className="text-xs text-muted">{g.dueDate}</span>}
                  {tab === 'active' ? (
                    <button
                      onClick={() => markComplete(g.id)}
                      className="text-xs text-brand hover:underline"
                    >
                      Complete
                    </button>
                  ) : (
                    <button
                      onClick={() => reopen(g.id)}
                      className="text-xs text-muted hover:text-text"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, g.progress)}%` }}
                />
              </div>
              <span className="text-xs text-muted mt-1 block">{g.progress}% complete</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
