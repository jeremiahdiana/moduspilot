'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Habit {
  id: string;
  title: string;
  description?: string;
  streak: number;
  completedDates: string[];
  frequency: 'daily' | 'weekly';
}

export default function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'habits'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setHabits(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        streak: d.data().streak ?? 0,
        completedDates: d.data().completedDates ?? [],
        frequency: d.data().frequency ?? 'daily',
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function toggleToday(habit: Habit) {
    if (!user) return;
    const doneToday = habit.completedDates.includes(today);
    const newDates = doneToday
      ? habit.completedDates.filter(d => d !== today)
      : [...habit.completedDates, today];

    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    for (const d of sorted) {
      if (d === check.toISOString().slice(0, 10)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), {
      completedDates: newDates,
      streak,
    });
  }

  // Build last 7 days for the completion grid
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Habits</h1>
        <p className="text-muted text-sm mt-1">Build consistency, one day at a time.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm">No habits yet. Tell MODUS what you want to build.</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {/* Day headers */}
          <div className="flex items-center gap-2 pl-4 mb-1">
            <div className="flex-1" />
            <div className="flex gap-1.5">
              {last7.map(d => (
                <span key={d} className="w-6 text-center text-xs text-muted">
                  {new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' })}
                </span>
              ))}
            </div>
            <div className="w-12" />
          </div>

          {habits.map(h => {
            const doneToday = h.completedDates.includes(today);
            return (
              <div key={h.id} className="bg-panel border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => toggleToday(h)}
                  className={`w-5 h-5 shrink-0 rounded border transition-colors flex items-center justify-center ${
                    doneToday ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                  }`}
                >
                  {doneToday && <span className="text-white text-[9px] leading-none">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{h.title}</p>
                  {h.description && <p className="text-xs text-muted">{h.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {last7.map(d => (
                    <span
                      key={d}
                      className={`w-6 h-6 rounded-sm ${
                        h.completedDates.includes(d) ? 'bg-brand' : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted shrink-0 w-12 text-right">{h.streak}🔥</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
