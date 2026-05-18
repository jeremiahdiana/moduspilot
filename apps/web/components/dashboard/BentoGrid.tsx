'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import GoalCard from './GoalCard';
import HabitTracker from './HabitTracker';
import TaskList from './TaskList';
import StreakWidget from './StreakWidget';

export default function BentoGrid() {
  const { user } = useAuth();
  const [tasksDueToday, setTasksDueToday] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const count = snap.docs.filter(d => !d.data().done && d.data().dueDate === today).length;
      setTasksDueToday(count);
    }, () => {});
    return unsub;
  }, [user, today]);

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-[120px]">
      {/* Goals — wide, tall */}
      <div className="col-span-8 row-span-3 bg-panel border border-border rounded-2xl p-5 overflow-hidden">
        <GoalCard />
      </div>

      {/* Streak — narrow */}
      <div className="col-span-4 row-span-2 bg-panel border border-border rounded-2xl p-5">
        <StreakWidget />
      </div>

      {/* Tasks due today */}
      <div className="col-span-4 row-span-1 bg-brand/10 border border-brand/20 rounded-2xl p-5 flex items-center gap-3">
        <span className="text-3xl font-black text-brand">{tasksDueToday}</span>
        <span className="text-sm text-muted">tasks due today</span>
      </div>

      {/* Habits */}
      <div className="col-span-6 row-span-2 bg-panel border border-border rounded-2xl p-5">
        <HabitTracker />
      </div>

      {/* Tasks */}
      <div className="col-span-6 row-span-2 bg-panel border border-border rounded-2xl p-5">
        <TaskList />
      </div>
    </div>
  );
}
