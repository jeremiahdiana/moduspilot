'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Habit {
  id: string;
  title: string;
  streak: number;
  completedDates: string[];
  frequency?: 'daily' | 'weekly';
}

export default function HabitTracker() {
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

    // Recalculate streak from completed dates
    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    for (const d of sorted) {
      const expected = check.toISOString().slice(0, 10);
      if (d === expected) {
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

  return (
    <div className="h-full flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-xs text-center">No habits yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {habits.map(h => {
            const doneToday = h.completedDates.includes(today);
            return (
              <div key={h.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => toggleToday(h)}
                  className={`w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                    doneToday ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                  }`}
                >
                  {doneToday && <span className="text-white text-[8px] leading-none">✓</span>}
                </button>
                <span className="flex-1 text-sm text-text truncate">{h.title}</span>
                <span className="text-xs text-muted shrink-0">{h.streak}🔥</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
