'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';

type Timeframe = 'short' | 'mid' | 'long';

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: 'active' | 'completed';
  dueDate?: string;
  timeframe?: Timeframe;
}

const TIMEFRAME_CONFIG: { key: Timeframe; label: string; sublabel: string; color: string; badge: string }[] = [
  { key: 'short', label: 'Short term',  sublabel: 'Days to a few weeks',  color: 'text-blue-500',  badge: 'bg-blue-500/10 text-blue-500' },
  { key: 'mid',   label: 'Mid term',    sublabel: '1–3 months',           color: 'text-amber-500', badge: 'bg-amber-500/10 text-amber-500' },
  { key: 'long',  label: 'Long term',   sublabel: '3 months and beyond',  color: 'text-brand',     badge: 'bg-brand/10 text-brand' },
];

export default function GoalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [collapsed, setCollapsed] = useState<Record<Timeframe, boolean>>({
    short: false, mid: false, long: false,
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'goals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        progress: d.data().progress ?? 0,
        status: d.data().status ?? 'active',
        dueDate: d.data().dueDate,
        timeframe: d.data().timeframe ?? undefined,
      })).filter(g => g.status !== 'deleted' as string));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function setTimeframe(goalId: string, timeframe: Timeframe) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), { timeframe });
  }

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const uncategorized = active.filter(g => !g.timeframe);

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
      ) : tab === 'active' ? (
        <div className="space-y-8 max-w-2xl">
          {/* Uncategorized — prompt to set timeframe */}
          {uncategorized.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Needs categorizing</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-border text-muted">{uncategorized.length}</span>
              </div>
              <div className="space-y-2">
                {uncategorized.map(g => (
                  <div key={g.id} className="bg-panel border border-border rounded-xl p-4">
                    <p className="text-sm font-medium text-text mb-1">{g.title}</p>
                    {g.description && <p className="text-xs text-muted mb-3">{g.description}</p>}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted mr-1">Set timeframe:</span>
                      {TIMEFRAME_CONFIG.map(tf => (
                        <button
                          key={tf.key}
                          onClick={e => { e.stopPropagation(); setTimeframe(g.id, tf.key); }}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-bg hover:border-current transition-colors ${tf.color}`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted text-sm">No active goals. Tell MODUS what you want to achieve.</p>
            </div>
          )}

          {/* Timeframe sections */}
          {TIMEFRAME_CONFIG.map(tf => {
            const tfGoals = active.filter(g => g.timeframe === tf.key);
            if (tfGoals.length === 0) return null;
            const isCollapsed = collapsed[tf.key];
            return (
              <div key={tf.key}>
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [tf.key]: !c[tf.key] }))}
                  className="flex items-center gap-2 mb-3 w-full text-left group"
                >
                  <span className={`text-xs font-semibold uppercase tracking-widest ${tf.color}`}>{tf.label}</span>
                  <span className="text-[11px] text-muted">{tf.sublabel}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-border text-muted ml-1">{tfGoals.length}</span>
                  <span className="ml-auto text-muted text-xs group-hover:text-text transition-colors">
                    {isCollapsed ? '▾' : '▴'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {tfGoals.map(g => (
                      <GoalRow key={g.id} goal={g} tf={tf} onClick={() => router.push(`/goals/${g.id}`)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {completed.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted text-sm">No completed goals yet.</p>
            </div>
          ) : completed.map(g => (
            <div
              key={g.id}
              onClick={() => router.push(`/goals/${g.id}`)}
              className="bg-panel border border-border rounded-xl p-5 cursor-pointer hover:border-brand/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-text line-through opacity-60">{g.title}</p>
                  {g.description && <p className="text-sm text-muted mt-0.5">{g.description}</p>}
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                  Complete
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({
  goal,
  tf,
  onClick,
}: {
  goal: Goal;
  tf: typeof TIMEFRAME_CONFIG[0];
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-panel border border-border rounded-xl p-5 cursor-pointer hover:border-brand/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text truncate group-hover:text-brand transition-colors">{goal.title}</p>
          {goal.description && <p className="text-sm text-muted mt-0.5 truncate">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {goal.dueDate && <span className="text-xs text-muted">{goal.dueDate}</span>}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tf.badge}`}>
            {tf.label}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${Math.min(100, goal.progress)}%` }}
        />
      </div>
      <span className="text-xs text-muted mt-1.5 block">{goal.progress}% complete</span>
    </div>
  );
}
