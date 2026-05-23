'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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

const PRIORITY_BAND: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-yellow-400',
  low:    'bg-muted',
};
const PRIORITY_LABEL: Record<string, string> = {
  high:   'text-red-400',
  medium: 'text-yellow-400',
  low:    'text-muted',
};
const PRIORITY_FILTER_OPTS = ['all', 'high', 'medium', 'low'] as const;
type PriorityFilter = typeof PRIORITY_FILTER_OPTS[number];

const today = new Date().toISOString().slice(0, 10);
function isOverdue(dueDate?: string) { return dueDate && dueDate < today; }

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [quickAdd, setQuickAdd] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

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

  async function deleteTask(task: Task) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), { deleted: true });
  }

  async function startEdit(task: Task) {
    setEditingId(task.id);
    setEditValue(task.title);
    setTimeout(() => editRef.current?.select(), 30);
  }

  async function saveEdit(task: Task) {
    if (!user || !editValue.trim() || editValue.trim() === task.title) {
      setEditingId(null);
      return;
    }
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), { title: editValue.trim() });
    setEditingId(null);
  }

  async function handleQuickAdd(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !quickAdd.trim() || !user) return;
    const title = quickAdd.trim();
    setQuickAdd('');
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      title,
      done: false,
      deleted: false,
      source: 'manual',
      createdAt: serverTimestamp(),
    });
  }

  const visible = tasks.filter(t => {
    if (t.deleted) return false;
    if (tab === 'todo' ? t.done : !t.done) return false;
    if (priorityFilter !== 'all') {
      if (tab === 'todo' && t.priority !== priorityFilter) return false;
    }
    return true;
  });

  const overdue  = visible.filter(t => isOverdue(t.dueDate));
  const dueToday = visible.filter(t => t.dueDate === today);
  const upcoming = visible.filter(t => t.dueDate && t.dueDate > today);
  const noDate   = visible.filter(t => !t.dueDate);

  const sections = tab === 'todo'
    ? [
        { label: 'Overdue',   tasks: overdue,   color: 'text-red-400' },
        { label: 'Due today', tasks: dueToday,  color: 'text-brand' },
        { label: 'Upcoming',  tasks: upcoming,  color: 'text-muted' },
        { label: 'No date',   tasks: noDate,    color: 'text-muted' },
      ].filter(s => s.tasks.length > 0)
    : [{ label: 'Completed', tasks: visible, color: 'text-muted' }];

  const allOverdue = tasks.filter(t => !t.deleted && !t.done && isOverdue(t.dueDate));
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

      {/* Quick-add */}
      <div className="flex items-center gap-2 max-w-2xl mb-5 px-4 py-2.5 bg-panel border border-border rounded-xl group focus-within:border-brand/50 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-muted shrink-0">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <input
          ref={quickRef}
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={handleQuickAdd}
          placeholder="Add a task and press Enter..."
          className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/50 outline-none"
        />
        {quickAdd && (
          <kbd className="text-[10px] text-muted bg-bg border border-border rounded px-1 py-0.5 font-mono shrink-0">↵</kbd>
        )}
      </div>

      {/* Tab + filter row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-panel border border-border rounded-lg p-1">
          {(['todo', 'done'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}
            >
              {t === 'todo' ? 'To Do' : 'Done'}
              {t === 'todo' && allOverdue.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-red-500/80 text-white px-1.5 py-0.5 rounded-full">{allOverdue.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'todo' && (
          <div className="flex gap-1">
            {PRIORITY_FILTER_OPTS.map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors border ${
                  priorityFilter === p
                    ? p === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : p === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      : p === 'low' ? 'bg-border border-border text-muted'
                      : 'bg-brand/10 border-brand/30 text-brand'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 max-w-2xl">
          <p className="text-muted text-sm">
            {tab === 'todo'
              ? priorityFilter !== 'all'
                ? `No ${priorityFilter}-priority tasks.`
                : 'No tasks. Ask MODUS to create some or type above.'
              : 'No completed tasks yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-widest ${section.color}`}>{section.label}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-border text-muted">{section.tasks.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {section.tasks.map(t => {
                    const idx = globalIndex++;
                    const isEditing = editingId === t.id;
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-panel border border-border rounded-xl flex items-stretch overflow-hidden group hover:border-brand/20 transition-colors"
                      >
                        {t.priority && <div className={`w-1 shrink-0 ${PRIORITY_BAND[t.priority] ?? 'bg-border'}`} />}

                        <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
                          <motion.button
                            onClick={() => toggleDone(t)}
                            whileTap={{ scale: 0.8 }}
                            className={`mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                              t.done ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                            }`}
                          >
                            {t.done && (
                              <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                                <path d="M2 6l3 3 5-5" />
                              </svg>
                            )}
                          </motion.button>

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input
                                ref={editRef}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(t)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit(t);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="w-full bg-bg border border-brand/40 rounded px-2 py-0.5 text-sm text-text outline-none focus:border-brand transition-colors"
                              />
                            ) : (
                              <p
                                onClick={() => !t.done && startEdit(t)}
                                className={`text-sm font-medium ${t.done ? 'line-through text-muted' : 'text-text cursor-text hover:text-brand transition-colors'}`}
                              >
                                {t.title}
                              </p>
                            )}
                            {t.description && !isEditing && (
                              <p className="text-xs text-muted mt-0.5 truncate">{t.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {t.priority && (
                                <span className={`text-xs font-medium capitalize ${PRIORITY_LABEL[t.priority] ?? 'text-muted'}`}>{t.priority}</span>
                              )}
                              {t.dueDate && (
                                <span className={`text-xs ${isOverdue(t.dueDate) && !t.done ? 'text-red-400 font-medium' : 'text-muted'}`}>
                                  {t.dueDate === today ? 'Today' : t.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delete button — hover reveal */}
                        <button
                          onClick={() => deleteTask(t)}
                          className="opacity-0 group-hover:opacity-100 px-3 text-muted hover:text-red-400 transition-all shrink-0"
                          title="Delete task"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
