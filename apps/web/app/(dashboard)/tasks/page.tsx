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
  deleted: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-muted',
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        done: d.data().done ?? false,
        deleted: d.data().deleted ?? false,
        dueDate: d.data().dueDate,
        priority: d.data().priority,
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  async function toggleDone(task: Task) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
      done: !task.done,
      ...(task.done ? {} : { completedAt: serverTimestamp() }),
    });
  }

  const visible = tasks.filter(t => !t.deleted && (tab === 'todo' ? !t.done : t.done));

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Tasks</h1>
        <p className="text-muted text-sm mt-1">Everything you need to get done.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
        {(['todo', 'done'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t === 'todo' ? 'To Do' : 'Done'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm">
            {tab === 'todo' ? 'No tasks. Ask MODUS to create some.' : 'No completed tasks yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {visible.map(t => (
            <div
              key={t.id}
              className="bg-panel border border-border rounded-xl px-4 py-3 flex items-start gap-3 group"
            >
              <button
                onClick={() => toggleDone(t)}
                className={`mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                  t.done ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                }`}
              >
                {t.done && <span className="text-white text-[8px] leading-none">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.done ? 'line-through text-muted' : 'text-text'}`}>
                  {t.title}
                </p>
                {t.description && <p className="text-xs text-muted mt-0.5">{t.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {t.priority && (
                    <span className={`text-xs font-medium capitalize ${PRIORITY_COLOR[t.priority] ?? 'text-muted'}`}>
                      {t.priority}
                    </span>
                  )}
                  {t.dueDate && <span className="text-xs text-muted">{t.dueDate}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
