'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, Timestamp, collection, query, where, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';

type Timeframe = 'short' | 'long';

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: 'active' | 'completed';
  dueDate?: string;
  timeframe?: Timeframe;
}

interface LinkedTask {
  id: string;
  title: string;
  done: boolean;
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  short: 'Short term',
  long:  'Long term',
};

const TIMEFRAME_COLORS: Record<Timeframe, string> = {
  short: 'bg-blue-500/10 text-blue-500',
  long:  'bg-brand/10 text-brand',
};

function checkinMessage(goal: Goal): string {
  if (goal.progress === 0)
    return `You're at 0% on "${goal.title}". What's the first move to get this started?`;
  if (goal.progress < 50)
    return `You're ${goal.progress}% into "${goal.title}". What's moved since you set this — and what's next?`;
  if (goal.progress < 100)
    return `You're ${goal.progress}% through "${goal.title}" — solid. What's left to get this across the line?`;
  return `"${goal.title}" is done. Want to capture any lessons before closing it out?`;
}

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
  const convLoaded = useRef(false);
  const savedLengthRef = useRef(0);
  const prevLoadingRef = useRef(false);
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
      const g: Goal = {
        id: snap.id,
        title: d.title ?? 'Untitled',
        description: d.description,
        progress: d.progress ?? 0,
        status: d.status ?? 'active',
        dueDate: d.dueDate,
        timeframe: d.timeframe,
      };
      setGoal(g);
      setDraftProgress(g.progress);
      setLoading(false);
    });
    return unsub;
  }, [user, id, router]);

  // Load linked tasks (tasks that mention the goal title)
  useEffect(() => {
    if (!user || !goal) return;
    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      where('done', '==', false),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      const tasks = snap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, title: d.data().title ?? '', done: d.data().done ?? false }))
        .filter(t => t.title.toLowerCase().includes(goal.title.toLowerCase().split(' ')[0]));
      setLinkedTasks(tasks.slice(0, 5));
    }, () => {});
    return unsub;
  }, [user, goal]);

  // Load existing goal conversation
  useEffect(() => {
    if (!user || !id || convLoaded.current) return;
    const convId = `goal-${id}`;
    getDoc(doc(db, 'users', user.uid, 'conversations', convId)).then(snap => {
      if (snap.exists()) {
        const msgs = snap.data().messages as Message[] ?? [];
        setConvMessages(msgs);
        savedLengthRef.current = msgs.length;
      }
      convLoaded.current = true;
    }).catch(() => { convLoaded.current = true; });
  }, [user, id]);

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user || !id || !goal) return;
    const convId = `goal-${id}`;
    await setDoc(doc(db, 'users', user.uid, 'conversations', convId), {
      title: `Goal: ${goal.title}`,
      messages: msgs,
      updatedAt: new Date(),
      deleted: false,
      goalId: id,
    }, { merge: true });
  }, [user, id, goal]);

  const initialMessages: Message[] = convMessages.length > 0
    ? convMessages
    : goal
      ? [{ id: `goal-checkin-${id}`, role: 'assistant', content: checkinMessage(goal) }]
      : [];

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

  // Re-seed messages when goal/conversation loads
  useEffect(() => {
    if (!convLoaded.current) return;
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convLoaded.current]);

  // Save conversation after AI responds
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

  if (loading || !goal) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Back */}
        <button
          onClick={() => router.push('/goals')}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
        >
          ← Goals
        </button>

        {/* Goal header */}
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="text-lg font-semibold text-text leading-tight">{goal.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {goal.timeframe && (
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${TIMEFRAME_COLORS[goal.timeframe]}`}>
                  {TIMEFRAME_LABELS[goal.timeframe]}
                </span>
              )}
              {goal.dueDate && (
                <span className="text-xs text-muted">{goal.dueDate}</span>
              )}
            </div>
          </div>
          {goal.description && (
            <p className="text-sm text-muted mt-1">{goal.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">Progress</span>
            {goal.status === 'active' && (
              <button
                onClick={() => setEditingProgress(e => !e)}
                className="text-xs text-brand hover:underline"
              >
                {editingProgress ? 'Cancel' : 'Update'}
              </button>
            )}
          </div>

          <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, editingProgress ? draftProgress : goal.progress)}%` }}
            />
          </div>
          <p className="text-sm text-text font-medium">
            {editingProgress ? draftProgress : goal.progress}% complete
          </p>

          {editingProgress && (
            <div className="mt-4 space-y-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draftProgress}
                onChange={e => setDraftProgress(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
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
                  {savingProgress ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {goal.status === 'active' && goal.progress < 100 && !editingProgress && (
            <button
              onClick={markComplete}
              className="mt-4 text-xs text-muted hover:text-text transition-colors"
            >
              Mark as complete →
            </button>
          )}
        </div>

        {/* Linked tasks */}
        {linkedTasks.length > 0 && (
          <div className="bg-panel border border-border rounded-xl p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted block mb-3">Linked tasks</span>
            <div className="space-y-2">
              {linkedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                  <span className="text-sm text-text">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted uppercase tracking-widest">MODUS on this goal</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* AI Chat */}
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

        {/* Chat input */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={`Update on "${goal.title}"...`}
              className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/50 outline-none border-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white shrink-0 disabled:opacity-30 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
