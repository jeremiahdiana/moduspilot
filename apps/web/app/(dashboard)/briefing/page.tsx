'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  Timestamp, doc, updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import type { BriefingData } from '@/lib/briefing';

interface Briefing {
  id: string;
  title: string;
  content: string;
  briefingData: BriefingData | null;
  createdAt: Date;
  read: boolean;
  energy: string | null;
}

function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDateShort(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconTarget() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function IconFlame() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/><path d="M19 17l.5 1.5L21 19l-1.5.5L19 21l-.5-1.5L17 19l1.5-.5z"/>
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
  );
}

// ── Energy ─────────────────────────────────────────────────────────────────

const ENERGY_OPTIONS = [
  { key: 'fully_charged', label: 'Fully charged', emoji: '🔋' },
  { key: 'okay',          label: 'Okay',           emoji: '😐' },
  { key: 'running_low',   label: 'Running low',    emoji: '😴' },
];

const ENERGY_LABELS: Record<string, string> = {
  fully_charged: 'Fully charged',
  okay: 'Okay',
  running_low: 'Running low',
};

// ── Main page ──────────────────────────────────────────────────────────────

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
        briefingData: d.data().briefingData ?? null,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        read: d.data().read ?? false,
        energy: d.data().energy ?? null,
      }));
      setBriefings(list);
      setSelected(prev => {
        if (prev) {
          // keep selected in sync with latest Firestore state
          const updated = list.find(b => b.id === prev.id);
          return updated ?? prev;
        }
        const today = list.find(b => b.createdAt >= todayStart());
        return today ?? list[0] ?? null;
      });
      setLoading(false);
    }, () => { setLoading(false); });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!selected || !user || selected.read) return;
    updateDoc(doc(db, 'users', user.uid, 'conversations', selected.id), { read: true }).catch(() => {});
  }, [selected?.id, user]);

  const handleEnergySelect = useCallback(async (key: string) => {
    if (!selected || !user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', selected.id), { energy: key });
  }, [selected, user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (briefings.length === 0) {
    return <EmptyBriefing />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar — past briefings */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col">
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
                  {formatDateShort(b.createdAt)}
                </p>
              </div>
              <p className="text-[11px] text-muted mt-0.5 truncate">
                {b.briefingData?.openingLine ?? b.content.slice(0, 55)}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Right — briefing content */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <BriefingView
            briefing={selected}
            onEnergySelect={handleEnergySelect}
            settings={settings}
            saveMessages={saveMessages}
            authToken={null}
          />
        </div>
      )}
    </div>
  );
}

// ── BriefingView ───────────────────────────────────────────────────────────

function BriefingView({
  briefing,
  onEnergySelect,
  settings,
  saveMessages,
}: {
  briefing: Briefing;
  onEnergySelect: (key: string) => void;
  settings: ReturnType<typeof useUserSettings>['settings'];
  saveMessages: (id: string, messages: Message[], title?: string) => Promise<void>;
  authToken: string | null;
}) {
  const { user } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const savedLengthRef = useRef(1);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      setAuthToken(u ? await u.getIdToken() : null);
    });
    return unsub;
  }, []);

  const initialMessages: Message[] = [{
    id: `briefing-${briefing.id}`,
    role: 'assistant',
    content: briefing.content,
  }];

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages,
    id: briefing.id,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '',
      responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '',
      briefingHour: settings.briefingHour ?? 7,
      briefingTimezone: settings.briefingTimezone ?? 'UTC',
    },
  });

  useEffect(() => {
    setMessages(initialMessages);
    savedLengthRef.current = 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing.id]);

  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length <= 1 || !user) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveMessages(briefing.id, messages);
  }, [isLoading, messages, briefing.id, saveMessages, user]);

  const chatMessages = messages.slice(1); // skip the briefing assistant message

  const data = briefing.briefingData;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">
            {formatDate(briefing.createdAt)}
          </p>
          <p className="text-xl font-semibold text-text">
            {data?.openingLine ?? briefing.title}
          </p>
        </div>
        {briefing.energy && (
          <div className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-3 py-1.5 shrink-0">
            <span className="text-xs">{ENERGY_OPTIONS.find(e => e.key === briefing.energy)?.emoji}</span>
            <span className="text-xs font-medium text-muted">{ENERGY_LABELS[briefing.energy]}</span>
          </div>
        )}
      </div>

      {data ? (
        <>
          {/* Energy check */}
          {!briefing.energy && (
            <Card icon={<IconActivity />} iconColor="text-amber-500" label="Energy check">
              <p className="text-sm text-muted mb-3">Where are you at this morning?</p>
              <div className="flex gap-2 flex-wrap">
                {ENERGY_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => onEnergySelect(opt.key)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-bg hover:border-brand/50 hover:bg-brand/5 text-text transition-colors"
                  >
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Top 3 */}
          {data.top3.length > 0 && (
            <Card icon={<IconTarget />} iconColor="text-blue-500" label="Top 3 today">
              <div className="space-y-2">
                {data.top3.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg"
                  >
                    <span className="text-xs font-semibold text-muted w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm text-text flex-1">{item.task}</span>
                    <span className="text-[11px] text-muted shrink-0">{item.source}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Loose end + Habits — 2 col on wide, stacked on narrow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.looseEnd && (
              <Card icon={<IconClock />} iconColor="text-orange-500" label="Loose end">
                <p className="text-sm text-text">{data.looseEnd.text}</p>
              </Card>
            )}

            {data.habits.length > 0 && (
              <Card icon={<IconFlame />} iconColor="text-orange-500" label="Habit check">
                <div className="space-y-2">
                  {data.habits.map((h, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-text">{h.name}</span>
                      {h.status === 'at_risk' && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
                          At risk
                        </span>
                      )}
                      {h.status === 'on_track' && (
                        <span className="text-[11px] text-muted">{h.streak}d streak</span>
                      )}
                      {h.status === 'done' && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                          Done
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Pattern callout */}
          {data.patternCallout && (
            <Card icon={<IconSparkle />} iconColor="text-brand" label="Pattern">
              <p className="text-sm text-text">{data.patternCallout}</p>
            </Card>
          )}
        </>
      ) : (
        /* Old briefing — plain text */
        <div className="bg-panel border border-border rounded-xl p-5">
          <p className="text-sm text-text whitespace-pre-wrap">{briefing.content}</p>
        </div>
      )}

      {/* Chat messages from follow-ups */}
      {chatMessages.length > 0 && (
        <div className="space-y-3 pt-2">
          {chatMessages.map((m, idx) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-brand text-white rounded-br-sm'
                    : 'bg-panel border border-border text-text rounded-bl-sm'
                }`}
              >
                {typeof m.content === 'string' ? m.content : ''}
                {isLoading && idx === chatMessages.length - 1 && m.role === 'assistant' && (
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
          {isLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
            <div className="flex gap-1 px-1">
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>
      )}

      {/* Closing + Chat input */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-text mb-0.5">
            That&apos;s your morning. Anything on your mind?
          </p>
          <p className="text-xs text-muted">
            Add a task, share what&apos;s weighing on you, or ask me to check something.
          </p>
        </div>

        {/* Quick pills */}
        <div className="px-3 py-2.5 flex gap-2 flex-wrap border-b border-border">
          {[
            { label: '+ Add a task', fill: 'Add task: ' },
            { label: 'What did I miss?', fill: 'Is there anything I missed in my briefing?' },
            { label: "Something's on my mind", fill: '' },
          ].map(pill => (
            <button
              key={pill.label}
              onClick={() => { setInput(pill.fill); }}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-bg hover:border-brand/50 hover:bg-brand/5 text-muted hover:text-text transition-colors"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!input.trim() || isLoading) return;
            const val = input.trim();
            setInput('');
            await append({ role: 'user', content: val });
          }}
          className="flex items-center gap-3 px-4 py-3"
        >
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type anything or just say what's on your mind..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
          >
            <IconArrowUp />
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

function Card({
  icon,
  iconColor,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={iconColor}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyBriefing() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/briefing/generate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setError('Something went wrong. Try again.');
      setGenerating(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <span className="text-4xl">◎</span>
      <h2 className="text-lg font-semibold text-text">No briefings yet</h2>
      <p className="text-sm text-muted max-w-xs">
        Your first briefing will arrive at your scheduled time, or generate one now.
      </p>
      <button
        onClick={generate}
        disabled={generating}
        className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-60 flex items-center gap-2"
      >
        {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {generating ? 'Generating...' : 'Generate briefing now'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
