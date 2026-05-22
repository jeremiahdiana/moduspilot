'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, onSnapshot, updateDoc, collection, query, where,
  addDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import MessageBubble from '@/components/chat/MessageBubble';
import { motion } from 'framer-motion';

type Timeframe = 'short' | 'long';

interface Milestone { id: string; title: string; done: boolean; }
interface ProgressEntry { progress: number; date: string; }

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: 'active' | 'completed';
  dueDate?: string;
  timeframe?: Timeframe;
  createdAt?: string;
  milestones: Milestone[];
  progressLog: ProgressEntry[];
}

interface GoalChat { id: string; title: string; messages: Message[]; createdAt: Date; }

const TF_BADGE: Record<Timeframe, string> = {
  short: 'bg-blue-500/10 text-blue-500',
  long:  'bg-brand/10 text-brand',
};
const TF_RING: Record<Timeframe, string> = {
  short: '#3B82F6',
  long:  '#7C3AED',
};
const TF_LABEL: Record<Timeframe, string> = {
  short: 'Short term',
  long:  'Long term',
};

const CHAT_CHIPS = [
  'Log a progress update',
  "What's blocking me?",
  'Help me plan next steps',
  'Reflect on this goal',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDue(dueDate: string): string {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days < 0) return `${dateStr} · ${Math.abs(days)}d overdue`;
  if (days === 0) return `${dateStr} · Due today`;
  if (days === 1) return `${dateStr} · Tomorrow`;
  return `${dateStr} · ${days}d left`;
}

function getMomentum(goal: Goal): { label: string; color: string } | null {
  if (!goal.dueDate || !goal.createdAt || goal.status !== 'active') return null;
  const created = new Date(goal.createdAt);
  const due = new Date(goal.dueDate + 'T00:00:00');
  const now = new Date();
  if (now > due) return { label: 'Past due', color: 'text-red-400' };
  const total = due.getTime() - created.getTime();
  if (total <= 0) return null;
  const elapsed = now.getTime() - created.getTime();
  const expected = Math.min(100, (elapsed / total) * 100);
  const gap = goal.progress - expected;
  if (gap >= 10) return { label: 'Ahead of schedule', color: 'text-emerald-500' };
  if (gap >= -10) return { label: 'On track', color: 'text-brand' };
  if (gap >= -25) return { label: 'Slightly behind', color: 'text-amber-500' };
  return { label: 'At risk', color: 'text-red-400' };
}

function checkinMessage(goal: Goal): string {
  if (goal.progress === 0)
    return `You're at 0% on "${goal.title}". What's the first move to get this started?`;
  if (goal.progress < 50)
    return `You're ${goal.progress}% into "${goal.title}". What's moved since you set this — and what's next?`;
  if (goal.progress < 100)
    return `You're ${goal.progress}% through "${goal.title}" — solid. What's left to get this across the line?`;
  return `"${goal.title}" is done. Want to capture any lessons before closing it out?`;
}

function sanitizeMessages(msgs: Message[]): { id: string; role: string; content: string }[] {
  return msgs.map(m => ({
    id: m.id,
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
}

// ── Ring ───────────────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 52, stroke = 5 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useUserSettings(user);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftProgress, setDraftProgress] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Milestones
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const milestoneInputRef = useRef<HTMLInputElement>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsFetchedRef = useRef(false);

  // Multi-chat
  const [allChats, setAllChats] = useState<GoalChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const activeChatIdRef = useRef(`goal-${id}`);
  const [activeChatId, _setActiveChatId] = useState(`goal-${id}`);
  const setActiveChatId = (newId: string) => { activeChatIdRef.current = newId; _setActiveChatId(newId); };

  const pendingMsgRef = useRef<string | null>(null);
  const savedLengthRef = useRef(0);
  const prevLoadingRef = useRef(false);
  const seededRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auth token
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      setAuthToken(u ? await u.getIdToken() : null);
    });
    return unsub;
  }, []);

  // Load goal
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'goals', id), snap => {
      if (!snap.exists()) { router.replace('/goals'); return; }
      const d = snap.data();
      setGoal({
        id: snap.id,
        title: d.title ?? 'Untitled',
        description: d.description,
        progress: d.progress ?? 0,
        status: d.status ?? 'active',
        dueDate: d.dueDate,
        timeframe: d.timeframe,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
        milestones: d.milestones ?? [],
        progressLog: d.progressLog ?? [],
      });
      setDraftProgress(d.progress ?? 0);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, id, router]);

  // Load chats
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'conversations'), where('goalId', '==', id)),
      snap => {
        const chats: GoalChat[] = snap.docs
          .filter(d => !d.data().deleted)
          .map(d => ({
            id: d.id,
            title: d.data().title ?? 'Chat',
            messages: (d.data().messages as Message[]) ?? [],
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          }))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setAllChats(chats);
        setChatsLoaded(true);
      },
      () => setChatsLoaded(true),
    );
    return unsub;
  }, [user, id]);

  // Suggestions
  useEffect(() => {
    if (!goal || suggestionsFetchedRef.current) return;
    suggestionsFetchedRef.current = true;
    setSuggestionsLoading(true);
    fetch('/api/goals/suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ title: goal.title, description: goal.description, timeframe: goal.timeframe }),
    })
      .then(r => r.json())
      .then(data => { if (data.suggestions?.length) setSuggestions(data.suggestions); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, [goal, authToken]);

  // Save conversation
  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user || !id) return;
    const chatId = activeChatIdRef.current;
    const isMain = chatId === `goal-${id}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'conversations', chatId), {
        goalId: id,
        ...(isMain ? { title: `Goal: ${goal?.title ?? 'Untitled'}` } : {}),
        messages: sanitizeMessages(msgs),
        updatedAt: new Date(),
        deleted: false,
      }, { merge: true });
    } catch (e) {
      console.error('[goal chat] save failed:', e);
    }
  }, [user, id, goal]);

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages: [],
    id: `goal-${id}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '',
      responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '',
      goalContext: goal
        ? { id: goal.id, title: goal.title, description: goal.description, progress: goal.progress, timeframe: goal.timeframe, activeChatId }
        : undefined,
    },
  });

  // Seed main chat once
  useEffect(() => {
    if (!chatsLoaded || seededRef.current || !goal) return;
    seededRef.current = true;
    const main = allChats.find(c => c.id === `goal-${id}`);
    const msgs: Message[] = main?.messages.length
      ? main.messages
      : [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }];
    setMessages(msgs);
    savedLengthRef.current = msgs.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatsLoaded, goal]);

  // Fire pending message after messages reset
  useEffect(() => {
    if (!pendingMsgRef.current || isLoading) return;
    const msg = pendingMsgRef.current;
    pendingMsgRef.current = null;
    append({ role: 'user', content: msg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Auto-save after response
  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length === 0) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveConversation(messages);
  }, [isLoading, messages, saveConversation]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus milestone input
  useEffect(() => {
    if (addingMilestone) milestoneInputRef.current?.focus();
  }, [addingMilestone]);

  // ── Chat helpers ───────────────────────────────────────────────────────────

  const mainChatId = `goal-${id}`;
  const isMainChat = activeChatId === mainChatId;
  const extraChats = allChats.filter(c => c.id !== mainChatId);

  function switchChat(chat: GoalChat) {
    setActiveChatId(chat.id);
    const msgs: Message[] = chat.messages.length
      ? chat.messages
      : (chat.id === mainChatId && goal)
        ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }]
        : [];
    setMessages(msgs);
    savedLengthRef.current = msgs.length;
  }

  async function deleteChat(chatId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', chatId), { deleted: true });
    if (activeChatId === chatId) {
      const main = allChats.find(c => c.id === mainChatId);
      if (main) { switchChat(main); }
      else {
        setActiveChatId(mainChatId);
        const msgs: Message[] = goal
          ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }]
          : [];
        setMessages(msgs);
        savedLengthRef.current = 0;
      }
    }
  }

  async function startNewChat() {
    if (!user) return;
    const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
      goalId: id, title: 'New chat', messages: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deleted: false,
    });
    setActiveChatId(ref.id);
    setMessages([]);
    savedLengthRef.current = 0;
  }

  async function tapSuggestion(text: string) {
    if (!user) return;
    const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
      goalId: id, title: text, messages: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deleted: false,
    });
    setActiveChatId(ref.id);
    savedLengthRef.current = 0;
    pendingMsgRef.current = text;
    setMessages([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim();
    setInput('');
    await append({ role: 'user', content: val });
  }

  // ── Progress helpers ───────────────────────────────────────────────────────

  async function saveProgress() {
    if (!user || !goal) return;
    setSavingProgress(true);
    const today = new Date().toISOString().slice(0, 10);
    const newLog = [{ progress: draftProgress, date: today }, ...goal.progressLog].slice(0, 10);
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), {
      progress: draftProgress,
      progressLog: newLog,
      ...(draftProgress >= 100 ? { status: 'completed' } : {}),
    });
    setSavingProgress(false);
  }

  async function markComplete() {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const newLog = [{ progress: 100, date: today }, ...(goal?.progressLog ?? [])].slice(0, 10);
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), { status: 'completed', progress: 100, progressLog: newLog });
    router.push('/goals');
  }

  // ── Milestone helpers ──────────────────────────────────────────────────────

  async function addMilestone() {
    if (!user || !goal || !newMilestoneTitle.trim()) return;
    const milestone: Milestone = { id: crypto.randomUUID(), title: newMilestoneTitle.trim(), done: false };
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), {
      milestones: [...goal.milestones, milestone],
    });
    setNewMilestoneTitle('');
    setAddingMilestone(false);
  }

  async function toggleMilestone(milestoneId: string) {
    if (!user || !goal) return;
    const newMilestones = goal.milestones.map(m => m.id === milestoneId ? { ...m, done: !m.done } : m);
    const doneCount = newMilestones.filter(m => m.done).length;
    const newProgress = Math.round((doneCount / newMilestones.length) * 100);
    const today = new Date().toISOString().slice(0, 10);
    const newLog = newProgress !== goal.progress
      ? [{ progress: newProgress, date: today }, ...goal.progressLog].slice(0, 10)
      : goal.progressLog;
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), {
      milestones: newMilestones,
      progress: newProgress,
      progressLog: newLog,
      ...(newProgress >= 100 ? { status: 'completed' } : {}),
    });
  }

  async function deleteMilestone(milestoneId: string) {
    if (!user || !goal) return;
    const newMilestones = goal.milestones.filter(m => m.id !== milestoneId);
    const updates: Record<string, unknown> = { milestones: newMilestones };
    if (newMilestones.length > 0) {
      const doneCount = newMilestones.filter(m => m.done).length;
      updates.progress = Math.round((doneCount / newMilestones.length) * 100);
    }
    await updateDoc(doc(db, 'users', user.uid, 'goals', id), updates);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || !goal) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ringColor = goal.timeframe ? TF_RING[goal.timeframe] : '#7C3AED';
  const hasMilestones = goal.milestones.length > 0;
  const momentum = getMomentum(goal);
  const progressChanged = draftProgress !== goal.progress;

  return (
    <div className="h-full overflow-hidden flex flex-col bg-bg">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border px-8 py-5 flex items-start gap-5">
        <button
          onClick={() => router.push('/goals')}
          className="shrink-0 mt-1 text-xs text-muted hover:text-text transition-colors"
        >
          ← Goals
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {goal.timeframe && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TF_BADGE[goal.timeframe]}`}>
                {TF_LABEL[goal.timeframe]}
              </span>
            )}
            {goal.status === 'completed' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                Complete
              </span>
            )}
            {goal.dueDate && (
              <span className="text-xs text-muted">{formatDue(goal.dueDate)}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text leading-tight">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted mt-0.5">{goal.description}</p>}
        </div>
        {goal.status === 'active' && (
          <button
            onClick={markComplete}
            className="shrink-0 text-xs font-medium px-4 py-2 rounded-lg border border-border text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-colors"
          >
            Mark complete
          </button>
        )}
      </div>

      {/* ── 2-column body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Left ─ scrollable detail */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 border-r border-border min-w-0">

          {/* Progress hero */}
          <div className="bg-panel border border-border rounded-xl p-6">
            <div className="flex items-center gap-8">
              <div className="relative shrink-0">
                <Ring pct={goal.progress} color={ringColor} size={116} stroke={7} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-text leading-none">{goal.progress}%</span>
                  <span className="text-[10px] text-muted mt-0.5">complete</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                {momentum && (
                  <p className={`text-xs font-semibold ${momentum.color}`}>{momentum.label}</p>
                )}

                {!hasMilestones && goal.status === 'active' && (
                  <div className="space-y-2">
                    <input
                      type="range" min={0} max={100} step={5}
                      value={draftProgress}
                      onChange={e => setDraftProgress(Number(e.target.value))}
                      className="w-full accent-brand"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">{draftProgress}%</span>
                      {progressChanged && (
                        <button
                          onClick={saveProgress}
                          disabled={savingProgress}
                          className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                        >
                          {savingProgress ? 'Saving…' : 'Save progress'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {hasMilestones && (
                  <p className="text-xs text-muted">Progress synced from milestones</p>
                )}

                {goal.progressLog.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {goal.progressLog.slice(0, 4).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                        <span>{entry.date}</span>
                        <span className="font-medium text-text/50">{entry.progress}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Milestones</span>
                {hasMilestones && (
                  <span className="text-[10px] bg-border text-muted px-1.5 py-0.5 rounded-full">
                    {goal.milestones.filter(m => m.done).length}/{goal.milestones.length}
                  </span>
                )}
              </div>
              {goal.status === 'active' && !addingMilestone && (
                <button
                  onClick={() => setAddingMilestone(true)}
                  className="text-xs text-muted hover:text-brand transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            {goal.milestones.length === 0 && !addingMilestone && (
              <p className="text-xs text-muted/50 text-center py-3">
                Break this goal into checkable steps — each one auto-updates progress.
              </p>
            )}

            <div className="space-y-0.5">
              {goal.milestones.map(m => (
                <div key={m.id} className="flex items-center gap-2.5 group py-1.5">
                  <button
                    onClick={() => goal.status === 'active' && toggleMilestone(m.id)}
                    className={`w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center ${
                      m.done ? 'bg-brand border-brand' : 'border-border hover:border-brand'
                    } ${goal.status !== 'active' ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {m.done && <span className="text-white text-[8px] leading-none">✓</span>}
                  </button>
                  <span className={`flex-1 text-sm ${m.done ? 'line-through text-muted' : 'text-text'}`}>
                    {m.title}
                  </span>
                  {goal.status === 'active' && (
                    <button
                      onClick={() => deleteMilestone(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted/50 hover:text-red-400 text-base leading-none transition-all"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {addingMilestone && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={milestoneInputRef}
                  value={newMilestoneTitle}
                  onChange={e => setNewMilestoneTitle(e.target.value)}
                  placeholder="Milestone description…"
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                  onKeyDown={e => {
                    if (e.key === 'Enter') addMilestone();
                    if (e.key === 'Escape') { setAddingMilestone(false); setNewMilestoneTitle(''); }
                  }}
                />
                <button
                  onClick={addMilestone}
                  disabled={!newMilestoneTitle.trim()}
                  className="text-xs font-semibold text-brand hover:underline disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingMilestone(false); setNewMilestoneTitle(''); }}
                  className="text-xs text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Explore */}
          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand shrink-0">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Explore with MODUS</span>
            </div>
            {suggestionsLoading ? (
              <div className="flex gap-1.5 flex-wrap">
                {[80, 120, 95, 140, 105].map((w, i) => (
                  <div key={i} className="h-6 rounded-full bg-border animate-pulse" style={{ width: `${w}px` }} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(suggestions.length > 0 ? suggestions : CHAT_CHIPS).map(s => (
                  <button key={s} onClick={() => tapSuggestion(s)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors text-left">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right ─ MODUS chat */}
        <div className="w-[360px] shrink-0 flex flex-col overflow-hidden">

          {/* Chat tabs */}
          <div className="shrink-0 border-b border-border px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-2">MODUS on this goal</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => {
                  const main = allChats.find(c => c.id === mainChatId);
                  if (main) { switchChat(main); }
                  else {
                    setActiveChatId(mainChatId);
                    const msgs: Message[] = goal
                      ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }]
                      : [];
                    setMessages(msgs);
                    savedLengthRef.current = 0;
                  }
                }}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  isMainChat ? 'bg-brand text-white border-brand' : 'border-border text-muted hover:text-text hover:border-brand/30'
                }`}
              >
                Main
              </button>

              {extraChats.map(c => (
                <div key={c.id} className={`shrink-0 flex items-center rounded-full border transition-colors ${
                  activeChatId === c.id ? 'bg-brand border-brand' : 'border-border hover:border-brand/30'
                }`}>
                  <button onClick={() => switchChat(c)} title={c.title}
                    className={`text-xs pl-2.5 pr-1 py-1 max-w-[90px] truncate ${
                      activeChatId === c.id ? 'text-white' : 'text-muted hover:text-text'
                    }`}>
                    {c.title.length > 14 ? c.title.slice(0, 11) + '…' : c.title}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteChat(c.id); }}
                    className={`pr-2 py-1 text-sm leading-none transition-colors ${
                      activeChatId === c.id ? 'text-white/60 hover:text-white' : 'text-muted/50 hover:text-muted'
                    }`}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button onClick={startNewChat}
                className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted hover:text-text hover:border-brand/40 transition-colors">
                + New
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, idx) => (
              <MessageBubble
                key={m.id}
                message={m}
                isStreaming={isLoading && idx === messages.length - 1}
              />
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

          {/* Quick chips */}
          <div className="shrink-0 border-t border-border px-3 py-2 flex gap-1 flex-wrap">
            {CHAT_CHIPS.map(chip => (
              <button key={chip} onClick={() => setInput(chip)} disabled={isLoading}
                className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-40 whitespace-nowrap">
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Message MODUS…"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/40 outline-none border-none"
              />
              <button type="submit" disabled={!input.trim() || isLoading}
                className="w-7 h-7 rounded-full bg-text flex items-center justify-center text-panel shrink-0 disabled:opacity-30 transition-opacity">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
