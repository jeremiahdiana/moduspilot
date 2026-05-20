'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';

type Timeframe = 'short' | 'long';
type Momentum = 'building' | 'steady' | 'stalled' | 'starting';

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: 'active' | 'completed';
  dueDate?: string;
  timeframe?: Timeframe;
  momentum?: Momentum;
}

interface LinkedTask { id: string; title: string }

const TIMEFRAME_LABELS: Record<Timeframe, string> = { short: 'Short term', long: 'Long term' };
const TIMEFRAME_COLORS: Record<Timeframe, string> = {
  short: 'bg-blue-500/10 text-blue-500',
  long:  'bg-brand/10 text-brand',
};

const MOMENTUM_OPTS: { key: Momentum; emoji: string; label: string }[] = [
  { key: 'building', emoji: '🚀', label: 'Building' },
  { key: 'steady',   emoji: '📈', label: 'Steady'   },
  { key: 'stalled',  emoji: '🛑', label: 'Stalled'  },
  { key: 'starting', emoji: '🌱', label: 'Just starting' },
];

const CHAT_CHIPS = [
  'Log a progress update',
  "What's blocking me?",
  'Help me plan next steps',
  'Reflect on this goal',
];

function checkinMessage(goal: Goal): string {
  if (goal.progress === 0)
    return `You're at 0% on "${goal.title}". What's the first move to get this started?`;
  if (goal.progress < 50)
    return `You're ${goal.progress}% into "${goal.title}". What's moved since you set this — and what's next?`;
  if (goal.progress < 100)
    return `You're ${goal.progress}% through "${goal.title}" — solid. What's left to get this across the line?`;
  return `"${goal.title}" is done. Want to capture any lessons before closing it out?`;
}

// ── Shared card ───────────────────────────────────────────────────────────────

function GCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-panel border border-border rounded-xl px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, color, text, right }: { icon: React.ReactNode; color: string; text: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{text}</span>
      </div>
      {right}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useUserSettings(user);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProgress, setEditingProgress] = useState(false);
  const [draftProgress, setDraftProgress] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Message[]>([]);
  const [convLoaded, setConvLoaded] = useState(false);
  const savedLengthRef = useRef(0);
  const prevLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      setAuthToken(u ? await u.getIdToken() : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'goals', id), snap => {
      if (!snap.exists()) { router.replace('/goals'); return; }
      const d = snap.data();
      const g: Goal = {
        id: snap.id,
        title: d.title ?? 'Untitled',
        description: d.description,
        progress: d.progress ?? 0,
        status: d.status ?? 'active',
        dueDate: d.dueDate,
        timeframe: d.timeframe,
        momentum: d.momentum,
      };
      setGoal(g);
      setDraftProgress(g.progress);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, id, router]);

  useEffect(() => {
    if (!user || !goal) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('done', '==', false), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const tasks = snap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, title: d.data().title ?? '' }))
        .filter(t => t.title.toLowerCase().includes(goal.title.toLowerCase().split(' ')[0]));
      setLinkedTasks(tasks.slice(0, 5));
    }, () => {});
    return unsub;
  }, [user, goal]);

  useEffect(() => {
    if (!user || !id || convLoaded) return;
    getDoc(doc(db, 'users', user.uid, 'conversations', `goal-${id}`)).then(snap => {
      if (snap.exists()) {
        const msgs = snap.data().messages as Message[] ?? [];
        setConvMessages(msgs);
        savedLengthRef.current = msgs.length;
      }
      setConvLoaded(true);
    }).catch(() => setConvLoaded(true));
  }, [user, id, convLoaded]);

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user || !id || !goal) return;
    await setDoc(doc(db, 'users', user.uid, 'conversations', `goal-${id}`), {
      title: `Goal: ${goal.title}`,
      messages: msgs,
      updatedAt: new Date(),
      deleted: false,
      goalId: id,
    }, { merge: true });
  }, [user, id, goal]);

  const initialMessages: Message[] = convMessages.length > 0
    ? convMessages
    : goal ? [{ id: `goal-checkin-${id}`, role: 'assistant', content: checkinMessage(goal) }] : [];

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages,
    id: `goal-${id}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '',
      responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '',
      goalContext: goal
        ? { id: goal.id, title: goal.title, description: goal.description, progress: goal.progress, timeframe: goal.timeframe }
        : undefined,
    },
  });

  useEffect(() => {
    if (!convLoaded) return;
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convLoaded]);

  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length === 0) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveConversation(messages);
  }, [isLoading, messages, saveConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function setMomentum(m: Momentum) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), { momentum: m });
  }

  async function saveProgress() {
    if (!user || !goal) return;
    setSavingProgress(true);
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), {
      progress: draftProgress,
      ...(draftProgress >= 100 ? { status: 'completed' } : {}),
    });
    setSavingProgress(false);
    setEditingProgress(false);
  }

  async function markComplete() {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), { status: 'completed', progress: 100 });
    router.push('/goals');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim();
    setInput('');
    await append({ role: 'user', content: val });
  }

  async function sendChip(text: string) {
    if (isLoading) return;
    await append({ role: 'user', content: text });
  }

  if (loading || !goal) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progressDisplay = editingProgress ? draftProgress : goal.progress;

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">

        {/* Back */}
        <button
          onClick={() => router.push('/goals')}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
        >
          ← Goals
        </button>

        {/* Goal header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            {goal.timeframe && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TIMEFRAME_COLORS[goal.timeframe]}`}>
                {TIMEFRAME_LABELS[goal.timeframe]}
              </span>
            )}
            {goal.dueDate && <span className="text-xs text-muted">Due {goal.dueDate}</span>}
          </div>
          <h1 className="text-xl font-bold text-text leading-snug">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted mt-1">{goal.description}</p>}
        </div>

        {/* ── Section 1: Momentum check ── */}
        <GCard>
          <SectionLabel
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            }
            color="text-amber-500"
            text="Momentum check"
          />
          <p className="text-sm text-muted mb-3">Where are you at with this goal right now?</p>
          <div className="flex gap-1.5 flex-wrap">
            {MOMENTUM_OPTS.map(o => (
              <button
                key={o.key}
                onClick={() => setMomentum(o.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  goal.momentum === o.key
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-bg border-border text-text hover:border-amber-500/30 hover:bg-amber-500/5'
                }`}
              >
                {o.emoji} {o.label}
              </button>
            ))}
          </div>
        </GCard>

        {/* ── Section 2: Progress ── */}
        <GCard>
          <SectionLabel
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            }
            color="text-blue-500"
            text="Progress"
            right={
              goal.status === 'active' ? (
                <button onClick={() => setEditingProgress(e => !e)} className="text-xs text-brand hover:underline">
                  {editingProgress ? 'Cancel' : 'Update'}
                </button>
              ) : undefined
            }
          />

          <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progressDisplay)}%` }}
            />
          </div>
          <p className="text-sm text-text font-semibold">{progressDisplay}% complete</p>

          {editingProgress && (
            <div className="mt-4 space-y-3">
              <input
                type="range" min={0} max={100} step={5}
                value={draftProgress}
                onChange={e => setDraftProgress(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <div className="flex items-center gap-3">
                <input
                  type="number" min={0} max={100}
                  value={draftProgress}
                  onChange={e => setDraftProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text outline-none focus:border-brand"
                />
                <span className="text-sm text-muted">%</span>
                <button
                  onClick={saveProgress}
                  disabled={savingProgress}
                  className="ml-auto bg-brand text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60"
                >
                  {savingProgress ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {goal.status === 'active' && goal.progress < 100 && !editingProgress && (
            <button onClick={markComplete} className="mt-3 text-xs text-muted hover:text-text transition-colors">
              Mark as complete →
            </button>
          )}
        </GCard>

        {/* ── Section 3: Linked tasks ── */}
        {linkedTasks.length > 0 && (
          <GCard>
            <SectionLabel
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l4 4L20 4"/>
                </svg>
              }
              color="text-emerald-500"
              text="Linked tasks"
            />
            <div className="space-y-2">
              {linkedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 bg-bg rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                  <span className="text-[13px] text-text">{t.title}</span>
                </div>
              ))}
            </div>
          </GCard>
        )}

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted uppercase tracking-widest">MODUS on this goal</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── Chat messages ── */}
        <div className="space-y-3">
          {messages.map((m, idx) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-brand text-white rounded-br-sm'
                  : 'bg-panel border border-border text-text rounded-bl-sm'
              }`}>
                {typeof m.content === 'string' ? m.content : ''}
                {isLoading && idx === messages.length - 1 && m.role === 'assistant' && (
                  <span className="inline-flex gap-0.5 ml-1 align-middle">
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-1 px-1">
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Closing chat bar ── */}
        <GCard className="!p-0 overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <p className="text-xs font-semibold text-muted mb-0.5">Talk to MODUS about this goal</p>
            <p className="text-[11px] text-muted/60">Share what&apos;s on your mind, log a win, or ask for help.</p>
          </div>

          <div className="px-5 pb-3 border-t border-border pt-3 flex gap-1.5 flex-wrap">
            {CHAT_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => sendChip(chip)}
                disabled={isLoading}
                className="text-[11px] px-3 py-1 rounded-full border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="border-t border-border">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-3">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder={`What's happening with "${goal.title}"?`}
                className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/40 outline-none border-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-text flex items-center justify-center text-panel shrink-0 disabled:opacity-30 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </form>
          </div>
        </GCard>

      </div>
    </div>
  );
}
