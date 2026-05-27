'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  type: 'goal' | 'project' | 'task' | 'habit' | 'conversation';
  href: string;
}

interface Action {
  label: string;
  description: string;
  href?: string;
  query?: string;
  icon: React.ReactNode;
}

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  goal: 'Goal',
  project: 'Project',
  task: 'Task',
  habit: 'Habit',
  conversation: 'Chat',
};

const TYPE_COLOR: Record<SearchResult['type'], string> = {
  goal: 'text-violet-400',
  project: 'text-orange-400',
  task: 'text-blue-400',
  habit: 'text-emerald-400',
  conversation: 'text-brand',
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-muted">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-muted">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const QUICK_ACTIONS: Action[] = [
  {
    label: 'Open Briefing',
    description: 'Go to your morning briefing',
    href: '/briefing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    label: 'Add a goal',
    description: 'Tell MODUS about a new goal',
    query: 'Add a new goal for me',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Add a task',
    description: 'Create a new task',
    query: 'Add a new task for me',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: 'Track a habit',
    description: 'Set up a new daily habit',
    query: 'Add a new habit for me',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
  },
  {
    label: 'Go to Dashboard',
    description: 'Your command center',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    description: 'Manage your preferences',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3" />
      </svg>
    ),
  },
];

async function loadAllResults(uid: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const [goalsSnap, projectsSnap, tasksSnap, habitsSnap, convsSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'goals')),
    getDocs(collection(db, 'users', uid, 'projects')),
    getDocs(collection(db, 'users', uid, 'tasks')),
    getDocs(collection(db, 'users', uid, 'habits')),
    getDocs(collection(db, 'users', uid, 'conversations')),
  ]);

  goalsSnap.forEach(doc => {
    const d = doc.data();
    if (d.status !== 'deleted') {
      results.push({ id: doc.id, label: d.title, sub: d.description || (d.status === 'completed' ? 'Completed' : 'Active'), type: 'goal', href: `/goals/${doc.id}` });
    }
  });

  projectsSnap.forEach(doc => {
    const d = doc.data();
    if (d.status !== 'archived') {
      results.push({ id: doc.id, label: d.title, sub: d.description || 'Project', type: 'project', href: `/projects/${doc.id}` });
    }
  });

  tasksSnap.forEach(doc => {
    const d = doc.data();
    if (!d.deleted) {
      results.push({ id: doc.id, label: d.title, sub: d.done ? 'Done' : (d.priority || 'medium'), type: 'task', href: '/reminders' });
    }
  });

  habitsSnap.forEach(doc => {
    const d = doc.data();
    results.push({ id: doc.id, label: d.title, sub: `${d.streak || 0}-day streak`, type: 'habit', href: '/reminders' });
  });

  convsSnap.forEach(doc => {
    const d = doc.data();
    if (!d.deleted) {
      results.push({ id: doc.id, label: d.title || 'Untitled chat', sub: 'Conversation', type: 'conversation', href: `/chat?conversationId=${doc.id}` });
    }
  });

  return results;
}

interface Props {
  open: boolean;
  onClose: () => void;
  user?: User | null;
}

export default function CommandBar({ open, onClose, user }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load Firestore data once when bar opens
  useEffect(() => {
    if (open && user && !dataLoaded) {
      loadAllResults(user.uid).then(r => { setAllData(r); setDataLoaded(true); });
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    if (!open) { setQ(''); setSelectedIndex(0); }
  }, [open, user, dataLoaded]);

  // Refresh data on reopen after being closed
  useEffect(() => {
    if (!open) setDataLoaded(false);
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return allData
      .filter(r => r.label?.toLowerCase().includes(term) || r.sub?.toLowerCase().includes(term))
      .slice(0, 10);
  }, [q, allData]);

  // Flat list used for keyboard nav — either search results or quick actions
  const showSearch = q.trim().length > 0;

  useEffect(() => { setSelectedIndex(0); }, [filtered, showSearch]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (showSearch && filtered.length > 0) {
      router.push(filtered[selectedIndex].href);
      onClose();
    } else if (q.trim()) {
      router.push(`/chat?q=${encodeURIComponent(q.trim())}`);
      onClose();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = showSearch ? filtered.length : QUICK_ACTIONS.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, total - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSearch && filtered.length > 0) {
        router.push(filtered[selectedIndex].href); onClose();
      } else if (showSearch && q.trim()) {
        router.push(`/chat?q=${encodeURIComponent(q.trim())}`); onClose();
      } else if (!showSearch) {
        const action = QUICK_ACTIONS[selectedIndex];
        if (action) handleAction(action);
      }
    }
  }

  function handleAction(action: Action) {
    if (action.href) router.push(action.href);
    else if (action.query) router.push(`/chat?q=${encodeURIComponent(action.query)}`);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            className="relative w-full max-w-xl bg-panel border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-4 border-b border-border/40">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or ask MODUS anything…"
                className="flex-1 bg-transparent text-text text-sm placeholder-muted outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} className="text-muted hover:text-text transition-colors"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              )}
              <kbd className="hidden sm:block text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
            </form>

            {/* Results */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto">
              {showSearch ? (
                filtered.length > 0 ? (
                  <div className="py-2">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-4 py-2">Results</p>
                    {filtered.map((r, i) => (
                      <button
                        key={r.id + r.type}
                        data-index={i}
                        onClick={() => { router.push(r.href); onClose(); }}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${i === selectedIndex ? 'bg-brand/8' : 'hover:bg-brand/5'}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-bg border border-border/50 flex items-center justify-center shrink-0">
                          <span className={`text-[9px] font-bold uppercase ${TYPE_COLOR[r.type]}`}>{r.type[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{r.label}</p>
                          <p className="text-[11px] text-muted truncate">{r.sub}</p>
                        </div>
                        <span className={`text-[10px] font-medium shrink-0 ${TYPE_COLOR[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                      </button>
                    ))}
                    {/* Send to chat fallback */}
                    <button
                      data-index={filtered.length}
                      onClick={() => { router.push(`/chat?q=${encodeURIComponent(q.trim())}`); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(filtered.length)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left border-t border-border/30 mt-1 transition-colors ${selectedIndex === filtered.length ? 'bg-brand/8' : 'hover:bg-brand/5'}`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-bg border border-border/50 flex items-center justify-center shrink-0 text-brand">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-muted">Ask MODUS: <span className="text-text font-medium">"{q.trim()}"</span></p>
                    </button>
                  </div>
                ) : (
                  <div className="py-2">
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-muted mb-3">No results for "{q}"</p>
                      <button
                        onClick={() => { router.push(`/chat?q=${encodeURIComponent(q.trim())}`); onClose(); }}
                        className="text-xs px-4 py-2 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
                      >
                        Ask MODUS instead →
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="py-2">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-4 py-2">Quick Actions</p>
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={action.label}
                      data-index={i}
                      onClick={() => handleAction(action)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors group text-left ${i === selectedIndex ? 'bg-brand/8' : 'hover:bg-brand/5'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg bg-bg border flex items-center justify-center shrink-0 transition-colors ${i === selectedIndex ? 'text-brand border-brand/30' : 'border-border/50 text-muted group-hover:text-brand group-hover:border-brand/30'}`}>
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text">{action.label}</p>
                        <p className="text-[11px] text-muted">{action.description}</p>
                      </div>
                      <ArrowIcon />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
              <p className="text-[11px] text-muted">
                {showSearch ? '↑↓ navigate · Enter to open · Tab for chat' : 'Type to search goals, projects, reminders, chats'}
              </p>
              <div className="flex items-center gap-1.5">
                <kbd className="text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">⌘</kbd>
                <kbd className="text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">K</kbd>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
