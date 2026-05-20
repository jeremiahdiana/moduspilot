'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import ChatWindow from '@/components/chat/ChatWindow';
import type { Message } from 'ai';
import { useConversations } from '@/hooks/useConversations';

interface Briefing {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  read?: boolean;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function BriefingPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings(user);
  const { saveMessages } = useConversations(user?.uid ?? null);

  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selected, setSelected] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      where('briefing', '==', true),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Morning Briefing',
        content: d.data().messages?.[0]?.content ?? '',
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        read: d.data().read ?? false,
      }));
      setBriefings(list);
      // Auto-select today's briefing on first load
      setSelected(prev => {
        if (prev) return prev;
        const today = list.find(b => b.createdAt >= todayStart());
        return today ?? list[0] ?? null;
      });
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Mark as read when selected
  useEffect(() => {
    if (!selected || !user || selected.read) return;
    updateDoc(doc(db, 'users', user.uid, 'conversations', selected.id), { read: true }).catch(() => {});
  }, [selected, user]);

  const handleMessagesChange = useCallback(async (messages: Message[], title?: string) => {
    if (!selected) return;
    await saveMessages(selected.id, messages, title);
  }, [selected, saveMessages]);

  const initialMessages: Message[] = selected ? [{
    id: `briefing-${selected.id}`,
    role: 'assistant',
    content: selected.content,
  }] : [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (briefings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-4xl">◎</span>
        <h2 className="text-lg font-semibold text-text">No briefings yet</h2>
        <p className="text-sm text-muted max-w-xs">
          Your first briefing will arrive at your scheduled time. You can adjust it in Settings → General.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Briefing list */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Briefings</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {briefings.map(b => (
            <button
              key={b.id}
              onClick={() => setSelected(b)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                selected?.id === b.id
                  ? 'bg-brand/10 border-r-2 border-brand'
                  : 'hover:bg-panel'
              }`}
            >
              <div className="flex items-center gap-2">
                {!b.read && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                <p className={`text-xs font-medium truncate ${selected?.id === b.id ? 'text-brand' : 'text-text'}`}>
                  {formatDate(b.createdAt)}
                </p>
              </div>
              <p className="text-[11px] text-muted mt-0.5 truncate">{b.content.slice(0, 60)}…</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Briefing content + chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected && (
          <div className="px-6 py-4 border-b border-border shrink-0">
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">{formatDate(selected.createdAt)}</p>
            <h1 className="text-base font-semibold text-text mt-0.5">{selected.title}</h1>
          </div>
        )}
        {selected ? (
          <ChatWindow
            key={selected.id}
            conversationId={selected.id}
            initialMessages={initialMessages}
            onMessagesChange={handleMessagesChange}
            personalContext={settings.personalContext}
            responseStyle={settings.responseStyle}
            customStyle={settings.customStyle}
            briefingHour={settings.briefingHour}
            briefingTimezone={settings.briefingTimezone}
          />
        ) : null}
      </div>
    </div>
  );
}
