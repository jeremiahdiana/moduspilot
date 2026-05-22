'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
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

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-yellow-400',
  low:    'bg-muted',
};

const PRIORITY_LABEL: Record<string, string> = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-muted',
};

const today = new Date().toISOString().slice(0, 10);

function isOverdue(dueDate?: string) {
  return dueDate && dueDate < today;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
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

  // Group into sections (todo tab only)
  const overdue   = visible.filter(t => isOverdue(t.dueDate));
  const dueToday  = visible.filter(t => t.dueDate === today);
  const upcoming  = visible.filter(t => t.dueDate && t.dueDate > today);
  const noDate    = visible.filter(t => !t.dueDate);

  const sections = tab === 'todo'
    ? [
        { label: 'Overdue',  tasks: overdue,  color: 'text-red-400' },
        { label: 'Due today', tasks: dueToday, color: 'text-brand' },
        { label: 'Upcoming', tasks: upcoming,  color: 'text-muted' },
        { label: 'No date',  tasks: noDate,    color: 'text-muted' },
      ].filter(s => s.tasks.length > 0)
    : [{ label: 'Done', tasks: visible, color: 'text-muted' }];

  let globalIndex = 0;

  return (
    <div className="p-8 overflow-y-auto h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-text">Tasks</h1>
        <p className="text-muted text-sm mt-0.5">Everything you need to get done.</p>
      </motion.div>

      <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
        {(['todo', 'done'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t === 'todo' ? 'To Do' : 'Done'}
            {t === 'todo' && overdue.length > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold bg-red-500/80 text-white px-1.5 py-0.5 rounded-full">
                {overdue.length}
              </span>
            )}
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
        <div className="space-y-8 max-w-2xl">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-widest ${section.color}`}>
                  {section.label}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-border text-muted">{section.tasks.length}</span>
              </div>
              <div className="space-y-2">
                {section.tasks.map(t => {
                  const idx = globalIndex++;
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-panel border border-border rounded-xl flex items-stretch overflow-hidden group hover:border-brand/20 transition-colors"
                    >
                      {/* Priority band */}
                      {t.priority && (
                        <div className={`w-1 shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-border'}`} />
                      )}

                      <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
                        <motion.button
                          onClick={() => toggleDone(t)}
                          whileTap={{ scale: 0.8 }}
                          animate={t.done ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                            t.done ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                          }`}
                        >
                          {t.done && <span className="text-white text-[8px] leading-none">✓</span>}
                        </motion.button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${t.done ? 'line-through text-muted' : 'text-text'}`}>
                            {t.title}
                          </p>
                          {t.description && <p className="text-xs text-muted mt-0.5 truncate">{t.description}</p>}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {t.priority && (
                              <span className={`text-xs font-medium capitalize ${PRIORITY_LABEL[t.priority] ?? 'text-muted'}`}>
                                {t.priority}
                              </span>
                            )}
                            {t.dueDate && (
                              <span className={`text-xs ${isOverdue(t.dueDate) && !t.done ? 'text-red-400 font-medium' : 'text-muted'}`}>
                                {t.dueDate === today ? 'Today' : t.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
