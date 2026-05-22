'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import type { GmailThread } from '@/lib/google-gmail';

type Thread = GmailThread & { accountEmail?: string };
type Filter = 'primary' | 'all';

interface GoogleAccount {
  email: string;
  connectedAt: string | null;
}

function avatarColor(name: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function initials(from: string): string {
  const parts = from.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : from.slice(0, 2).toUpperCase();
}

function shortEmail(email: string): string {
  return email.split('@')[0];
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function GmailWidget() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<'all' | string>('all');
  const [filter, setFilter] = useState<Filter>('primary');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useCallback(async (account: string, f: Filter) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ filter: f });
      if (account !== 'all') params.set('account', account);
      const res = await fetch(`/api/google/inbox?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.notConnected) {
        setNotConnected(true);
        setThreads([]);
        setAccounts([]);
      } else {
        setNotConnected(false);
        setThreads(data.threads ?? []);
        setAccounts(data.accounts ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchThreads(selectedAccount, filter);
  }, [fetchThreads, selectedAccount, filter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasMultipleAccounts = accounts.length > 1;

  const accountLabel = selectedAccount === 'all'
    ? 'All inboxes'
    : shortEmail(selectedAccount);

  // Controls row shown above threads
  const controls = (
    <div className="flex items-center justify-between mb-3 gap-2">
      {/* Account selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-text bg-bg border border-border px-2.5 py-1.5 rounded-lg transition-colors max-w-[140px]"
        >
          <span className="truncate">{accountLabel}</span>
          <ChevronDown />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 top-full left-0 mt-1.5 bg-panel border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            {hasMultipleAccounts && (
              <button
                onClick={() => { setSelectedAccount('all'); setDropdownOpen(false); }}
                className={`w-full text-left text-xs px-3 py-2 transition-colors ${selectedAccount === 'all' ? 'bg-brand/10 text-brand' : 'text-text hover:bg-brand/5'}`}
              >
                All inboxes
              </button>
            )}
            {accounts.map(a => (
              <button
                key={a.email}
                onClick={() => { setSelectedAccount(a.email); setDropdownOpen(false); }}
                className={`w-full text-left text-xs px-3 py-2 transition-colors truncate ${selectedAccount === a.email ? 'bg-brand/10 text-brand' : 'text-text hover:bg-brand/5'}`}
              >
                {a.email}
              </button>
            ))}
            <div className="border-t border-border/50 mt-0.5">
              <Link
                href="/settings?tab=connectors"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-brand px-3 py-2 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add account
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center bg-bg border border-border rounded-lg p-0.5 gap-0.5 shrink-0">
        {(['primary', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors capitalize ${
              filter === f
                ? 'bg-brand text-white'
                : 'text-muted hover:text-text'
            }`}
          >
            {f === 'primary' ? 'Primary' : 'All'}
          </button>
        ))}
      </div>
    </div>
  );

  if (notConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
        <p className="text-xs text-muted">Gmail not connected.</p>
        <p className="text-xs text-muted">Ask MODUS to connect Google in chat.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        {accounts.length > 0 && controls}
        <div className="flex items-center justify-center h-24">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (threads.length === 0) {
    return (
      <>
        {controls}
        <div className="flex flex-col items-center justify-center h-20 gap-1">
          <p className="text-xs text-muted">
            {filter === 'primary' ? 'No unread primary emails in 48h.' : 'Inbox clear — no unread emails in 48h.'}
          </p>
          {filter === 'primary' && (
            <button onClick={() => setFilter('all')} className="text-[11px] text-brand hover:underline">
              Show all categories
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {controls}
      <div className="divide-y divide-border/50 -mx-5">
        {threads.map(t => (
          <Link
            key={t.id}
            href="/briefing"
            className="flex items-start gap-3 py-3 hover:bg-brand/5 px-5 transition-colors group"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: avatarColor(t.from) }}
            >
              {initials(t.from)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className="text-xs font-semibold text-text truncate">{t.from}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasMultipleAccounts && selectedAccount === 'all' && t.accountEmail && (
                    <span className="text-[9px] text-muted bg-border/50 px-1.5 py-0.5 rounded font-medium">
                      {shortEmail(t.accountEmail)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted">{t.date?.slice(0, 6)}</span>
                </div>
              </div>
              <p className="text-xs text-text truncate">{t.subject}</p>
              <p className="text-[11px] text-muted truncate mt-0.5">{t.snippet}</p>
            </div>
            {t.unread && (
              <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0 mt-2" />
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
