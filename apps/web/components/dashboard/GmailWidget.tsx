'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import type { GmailThread } from '@/lib/google-gmail';

function avatarColor(name: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];
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

export default function GmailWidget() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    user.getIdToken().then(async token => {
      try {
        const res = await fetch('/api/google/inbox', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.notConnected) setNotConnected(true);
        setThreads(data.threads ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
        <p className="text-xs text-muted">Gmail not connected.</p>
        <p className="text-xs text-muted">Ask MODUS to connect Google in chat.</p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-muted">Inbox clear — no unread emails in 48h.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {threads.map(t => (
        <Link
          key={t.id}
          href="/briefing"
          className="flex items-start gap-3 py-3 hover:bg-brand/5 -mx-5 px-5 transition-colors group"
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
              <span className="text-[10px] text-muted shrink-0">{t.date?.slice(0, 6)}</span>
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
  );
}
