'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Action {
  label: string;
  description: string;
  href?: string;
  query?: string;
  icon: React.ReactNode;
}

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

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandBar({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
    onClose();
  }

  function handleAction(action: Action) {
    if (action.href) {
      router.push(action.href);
    } else if (action.query) {
      router.push(`/chat?q=${encodeURIComponent(action.query)}`);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-panel border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-4 border-b border-border/40">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask MODUS anything…"
            className="flex-1 bg-transparent text-text text-sm placeholder-muted outline-none"
          />
          <kbd className="hidden sm:block text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </form>

        {/* Quick actions */}
        <div className="py-2">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-4 py-2">Quick Actions</p>
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-brand/5 transition-colors group text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-bg border border-border/50 flex items-center justify-center text-muted group-hover:text-brand group-hover:border-brand/30 transition-colors shrink-0">
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

        <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
          <p className="text-[11px] text-muted">Type to ask MODUS · Enter to send</p>
          <div className="flex items-center gap-1.5">
            <kbd className="text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">⌘</kbd>
            <kbd className="text-[10px] text-muted bg-bg border border-border/50 rounded px-1.5 py-0.5 font-mono">K</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
