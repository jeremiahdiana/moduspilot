'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CalendarEvent } from '@/lib/google-calendar';

function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
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

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    user.getIdToken().then(async token => {
      try {
        const res = await fetch('/api/google/today', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.notConnected) setNotConnected(true);
        setEvents(data.events ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-muted">Google Calendar not connected.</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-xs text-muted">No events scheduled today.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {events.map((e, i) => (
        <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${eventColor(i)}`}>
          <span className="font-semibold">{fmtTime(e.start)}</span>
          <span className="truncate max-w-[160px]">{e.title}</span>
        </div>
      ))}
    </div>
  );
}
