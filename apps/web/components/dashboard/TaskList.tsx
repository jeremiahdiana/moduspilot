'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';

interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-yellow-400',
  low: 'bg-muted',
};

export default function TaskList() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().title ?? 'Untitled',
          description: d.data().description,
          done: d.data().done ?? false,
          dueDate: d.data().dueDate,
          priority: d.data().priority,
        }))
        .filter(t => !t.done)
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function markDone(taskId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), {
      done: true,
      completedAt: serverTimestamp(),
    });
  }

  return (
    <div className="h-full flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-xs text-center">No tasks yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {tasks.map(t => (
            <div key={t.id} className="flex items-start gap-2.5 group">
              <button
                onClick={() => markDone(t.id)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border border-border group-hover:border-brand transition-colors flex items-center justify-center"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {t.priority && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-muted'}`} />
                  )}
                  <span className="text-sm text-text truncate">{t.title}</span>
                </div>
                {t.dueDate && (
                  <span className="text-xs text-muted">{t.dueDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
