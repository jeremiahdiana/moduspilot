'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CalendarEvent } from '@/lib/google-calendar';
import { SkeletonList, Skeleton } from '@/components/ui/Skeleton';

function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function eventColor(index: number): string {
  const colors = ['bg-brand/20 text-brand', 'bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-yellow-500/20 text-yellow-400'];
  return colors[index % colors.length];
}

export default function CalendarWidget() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [accounts, setAccounts] = useState<{ email: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');

  // Fetch Google accounts
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async token => {
      try {
        const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      } catch { /* non-fatal */ }
    });
  }, [user]);

  // Fetch events when user or selectedAccount changes
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    user.getIdToken().then(async token => {
      try {
        const url = selectedAccount
          ? `/api/google/today?account=${encodeURIComponent(selectedAccount)}`
          : '/api/google/today';
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        // Reset on every fetch, not just latch true — otherwise a single
        // transient failure left the widget stuck on "not connected" forever.
        setNotConnected(!!data.notConnected);
        setEvents(data.events ?? []);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    });
  }, [user, selectedAccount]);

  if (loading) {
    return (
      <SkeletonList count={3} className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-3 flex-1" />
        </div>
      </SkeletonList>
    );
  }

  if (notConnected) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-muted">Google Calendar not connected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Account filter — only shown when multiple accounts */}
      {accounts.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedAccount('')}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${!selectedAccount ? 'bg-brand text-white border-brand' : 'border-border text-muted hover:text-text'}`}
          >
            All
          </button>
          {accounts.map(a => (
            <button
              key={a.email}
              onClick={() => setSelectedAccount(a.email)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors truncate max-w-[120px] ${selectedAccount === a.email ? 'bg-brand text-white border-brand' : 'border-border text-muted hover:text-text'}`}
            >
              {a.email.split('@')[0]}
            </button>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <div className="flex items-center justify-center h-16">
          <p className="text-xs text-muted">No events scheduled today.</p>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {events.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${eventColor(i)}`}>
              <span className="font-semibold">{fmtTime(e.start)}</span>
              <span className="truncate max-w-[160px]">{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
