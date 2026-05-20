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

function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function fmtFull(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtHeader(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtShort(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate()-1);
  if (d >= today) return 'Today';
  if (d >= yest) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

const IconBolt = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconChecks = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l4 4L20 4"/><path d="M4 18l4 4 12-12" opacity="0.4"/>
  </svg>
);
const IconTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconFlame = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);
const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconCalendarSmall = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);

// ── Shared card base ──────────────────────────────────────────────────────────

function BCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-panel border border-border rounded-xl px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function Label({ icon, color, text, right }: {
  icon: React.ReactNode;
  color: string;
  text: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{text}</span>
      </div>
      {right}
    </div>
  );
}

// ── Section 1: Energy check ───────────────────────────────────────────────────

const ENERGY_OPTS = [
  { key: 'fully_charged', label: 'Fully charged', emoji: '🔋' },
  { key: 'okay',          label: 'Okay',           emoji: '😐' },
  { key: 'running_low',   label: 'Running low',    emoji: '😴' },
];

function EnergyCard({ energy, onSelect }: { energy: string | null; onSelect: (k: string) => void }) {
  const [custom, setCustom] = useState('');
  return (
    <BCard>
      <Label icon={<IconBolt />} color="text-amber-500" text="Energy check" />
      <p className="text-sm text-muted mb-3">Where are you at this morning?</p>
      <div className="flex gap-1.5 flex-wrap">
        {ENERGY_OPTS.map(o => (
          <button
            key={o.key}
            onClick={() => onSelect(o.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              energy === o.key
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-bg border-border text-text hover:border-amber-500/30 hover:bg-amber-500/5'
            }`}
          >
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
      <input
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && custom.trim()) {
            onSelect('custom');
            setCustom('');
          }
        }}
        placeholder="Or type how you're feeling..."
        className="mt-3 w-full bg-transparent text-xs text-muted placeholder:text-muted/40 outline-none border-none"
      />
    </BCard>
  );
}

// ── Section 2: Approval queue ─────────────────────────────────────────────────

function ApprovalQueueCard() {
  return (
    <BCard>
      <Label
        icon={<IconChecks />}
        color="text-emerald-500"
        text="Approval queue"
        right={
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            0 pending
          </span>
        }
      />
      <p className="text-xs text-muted">
        No integrations connected.{' '}
        <span className="text-brand cursor-pointer hover:underline">Connect Gmail or Calendar</span>
        {' '}to surface pending actions here.
      </p>
    </BCard>
  );
}

// ── Section 3: Top 3 ──────────────────────────────────────────────────────────

function Top3Card({ items }: { items: { task: string; source: string }[] }) {
  return (
    <BCard>
      <Label icon={<IconTarget />} color="text-blue-500" text="Top 3 today" />
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-bg rounded-lg">
            <span className="text-[11px] font-semibold text-muted w-3.5 shrink-0">{i + 1}</span>
            <span className="text-[13px] text-text flex-1">{item.task}</span>
            <span className="text-[11px] text-muted shrink-0">{item.source}</span>
          </div>
        ))}
      </div>
    </BCard>
  );
}

// ── Section 4a: Loose end ─────────────────────────────────────────────────────

function LooseEndCard({ text, onHandle }: { text: string; onHandle?: () => void }) {
  return (
    <BCard className="flex flex-col">
      <Label icon={<IconClock />} color="text-orange-500" text="Loose end" />
      <p className="text-[13px] text-text flex-1">{text}</p>
      <button
        onClick={onHandle}
        className="mt-3 self-start text-[11px] px-2.5 py-1 rounded-lg border border-border bg-bg text-muted hover:text-text hover:border-border/80 transition-colors cursor-pointer"
      >
        Handle now ↗
      </button>
    </BCard>
  );
}

// ── Section 4b: Habit check ───────────────────────────────────────────────────

function HabitCheckCard({ habits }: { habits: { name: string; streak: number; status: 'at_risk' | 'on_track' | 'done' }[] }) {
  return (
    <BCard>
      <Label icon={<IconFlame />} color="text-orange-500" text="Habit check" />
      <div className="space-y-2">
        {habits.map((h, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[12px] text-text">{h.name}</span>
            {h.status === 'at_risk' && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                ⚡ At risk
              </span>
            )}
            {h.status === 'on_track' && (
              <span className="text-[11px] text-muted">{h.streak} day streak</span>
            )}
            {h.status === 'done' && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                ✓ On track
              </span>
            )}
          </div>
        ))}
      </div>
    </BCard>
  );
}

// ── Section 5: Pattern callout (conditional) ──────────────────────────────────

function PatternCard({ text }: { text: string }) {
  return (
    <div
      className="bg-panel border border-border rounded-xl px-5 py-4"
      style={{ borderLeft: '3px solid rgba(245,158,11,0.45)' }}
    >
      <Label icon={<IconEye />} color="text-amber-500" text="Modus noticed" />
      <p className="text-[13px] text-text">{text}</p>
    </div>
  );
}

// ── Section 6: Closing chat bar ───────────────────────────────────────────────

const QUICK_CHIPS = [
  { label: '+ Add a task',            fill: 'Add task: ' },
  { label: '↻ Check anything I missed?', fill: 'Is there anything important I missed in my briefing?' },
  { label: '📅 Show full schedule',   fill: 'Show me my schedule for today.' },
  { label: "Something's on my mind",  fill: '' },
];

function ClosingChatBar({
  input,
  onChange,
  onSubmit,
  onChip,
  isLoading,
}: {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onChip: (fill: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      {/* Heading */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[14px] font-medium text-text mb-0.5">
          That&apos;s your morning. Anything on your mind?
        </p>
        <p className="text-[12px] text-muted">
          Add a task, share what&apos;s weighing on you, or ask me to check something.
        </p>
      </div>

      {/* Quick chips */}
      <div className="px-2 py-2 flex gap-1.5 flex-wrap border-b border-border">
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onChip(chip.fill)}
            className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-bg text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 px-3 py-2.5">
        <input
          value={input}
          onChange={onChange}
          placeholder="Type anything or just say what's on your mind..."
          className="flex-1 bg-transparent text-[13px] text-text placeholder:text-muted/50 outline-none border-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="w-8 h-8 rounded-full bg-text flex items-center justify-center text-panel shrink-0 disabled:opacity-30 transition-opacity cursor-pointer"
        >
          <IconArrowUp />
        </button>
      </form>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  if (briefings.length === 0) return <EmptyBriefing />;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
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
                selected?.id === b.id ? 'bg-brand/10 border-r-2 border-brand' : 'hover:bg-panel'
              }`}
            >
              <div className="flex items-center gap-2">
                {!b.read && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                <p className={`text-xs font-medium truncate ${selected?.id === b.id ? 'text-brand' : 'text-text'}`}>
                  {fmtShort(b.createdAt)}
                </p>
              </div>
              <p className="text-[11px] text-muted mt-0.5 truncate">
                {b.briefingData?.openingLine ?? b.content.slice(0, 55)}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      {selected && (
        <BriefingContent
          key={selected.id}
          briefing={selected}
          onEnergySelect={handleEnergySelect}
          settings={settings}
          saveMessages={saveMessages}
        />
      )}
    </div>
  );
}

// ── Briefing content panel ────────────────────────────────────────────────────

function BriefingContent({
  briefing,
  onEnergySelect,
  settings,
  saveMessages,
}: {
  briefing: Briefing;
  onEnergySelect: (key: string) => void;
  settings: ReturnType<typeof useUserSettings>['settings'];
  saveMessages: (id: string, msgs: Message[], title?: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const savedLengthRef = useRef(1);
  const prevLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chatMessages = messages.slice(1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim();
    setInput('');
    await append({ role: 'user', content: val });
  }

  function handleChip(fill: string) {
    if (fill) setInput(fill);
    else {
      const inp = document.querySelector<HTMLInputElement>('input[placeholder*="Type anything"]');
      inp?.focus();
    }
  }

  const data = briefing.briefingData;
  const energyOpt = ENERGY_OPTS.find(o => o.key === briefing.energy);

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-2.5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted mb-0.5">
              {fmtHeader(briefing.createdAt)}
            </p>
            <p className="text-[18px] font-medium text-text leading-snug">
              {data?.openingLine ?? briefing.title}
            </p>
          </div>
          {briefing.energy && energyOpt && (
            <div className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 shrink-0 ml-4">
              <span className="text-amber-500"><IconBolt /></span>
              <span className="text-[12px] font-medium text-muted">{energyOpt.emoji} {energyOpt.label}</span>
            </div>
          )}
        </div>

        {data ? (
          <>
            {/* Section 1: Energy check — hide once answered */}
            {!briefing.energy && (
              <EnergyCard energy={briefing.energy} onSelect={onEnergySelect} />
            )}

            {/* Section 2: Approval queue */}
            <ApprovalQueueCard />

            {/* Section 3: Top 3 */}
            {data.top3.length > 0 && <Top3Card items={data.top3} />}

            {/* Section 4: Loose end + Habit check side by side */}
            {(data.looseEnd || data.habits.length > 0) && (
              <div className={`grid gap-2.5 ${data.looseEnd && data.habits.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {data.looseEnd && (
                  <LooseEndCard
                    text={data.looseEnd.text}
                    onHandle={() => setInput(`Handle: ${data.looseEnd!.text}`)}
                  />
                )}
                {data.habits.length > 0 && <HabitCheckCard habits={data.habits} />}
              </div>
            )}

            {/* Section 5: Pattern callout — conditional */}
            {data.patternCallout && <PatternCard text={data.patternCallout} />}
          </>
        ) : (
          /* Old plain-text briefing */
          <BCard>
            <p className="text-sm text-text whitespace-pre-wrap">{briefing.content}</p>
          </BCard>
        )}

        {/* Follow-up chat messages */}
        {chatMessages.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {chatMessages.map((m, idx) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-brand text-white rounded-br-sm'
                    : 'bg-panel border border-border text-text rounded-bl-sm'
                }`}>
                  {typeof m.content === 'string' ? m.content : ''}
                  {isLoading && idx === chatMessages.length - 1 && m.role === 'assistant' && (
                    <span className="inline-flex gap-0.5 ml-1 align-middle">
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

        <div ref={bottomRef} />

        {/* Section 6: Closing chat bar */}
        <ClosingChatBar
          input={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onChip={handleChip}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

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
