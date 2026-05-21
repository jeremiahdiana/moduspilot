'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, onSnapshot, updateDoc, collection, query, where,
  orderBy, addDoc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import MessageBubble from '@/components/chat/MessageBubble';

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

interface LinkedTask { id: string; title: string }
interface GoalChat  { id: string; title: string; messages: Message[]; createdAt: Date }

const TIMEFRAME_LABELS: Record<Timeframe, string> = { short: 'Short term', long: 'Long term' };
const TIMEFRAME_COLORS: Record<Timeframe, string> = {
  short: 'bg-blue-500/10 text-blue-500',
  long:  'bg-brand/10 text-brand',
};

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

function GCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-panel border border-border rounded-xl px-5 py-4 ${className}`}>{children}</div>;
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
const IconTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l4 4L20 4"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

function sanitizeMessages(msgs: Message[]): { id: string; role: string; content: string }[] {
  return msgs.map(m => ({
    id: m.id,
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsFetchedRef = useRef(false);

  // Multi-chat state
  const [allChats, setAllChats] = useState<GoalChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  // activeChatId is tracked via ref (sync) + state (for UI re-render)
  const activeChatIdRef = useRef(`goal-${id}`);
  const [activeChatId, _setActiveChatId] = useState(`goal-${id}`);
  const setActiveChatId = (newId: string) => { activeChatIdRef.current = newId; _setActiveChatId(newId); };

  // Pending message to send after messages reset (avoids setTimeout race)
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

  // Fetch AI-personalized suggestions once goal + auth token are ready
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

  // Load goal
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'goals', id), snap => {
      if (!snap.exists()) { router.replace('/goals'); return; }
      const d = snap.data();
      setGoal({ id: snap.id, title: d.title ?? 'Untitled', description: d.description,
        progress: d.progress ?? 0, status: d.status ?? 'active', dueDate: d.dueDate, timeframe: d.timeframe });
      setDraftProgress(d.progress ?? 0);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, id, router]);

  // Load linked tasks
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

  // Load all chats for this goal
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

  // Save to the currently active chat doc
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

  // useChat — id is FIXED to goal-${id} so the hook is always stable.
  // We swap messages manually via setMessages when switching chats.
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

  // Seed main chat messages once Firestore loads
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

  // Fire pending message AFTER messages state has reset to []
  // (avoids race condition — pendingMsgRef is set, then messages clears, then this fires)
  useEffect(() => {
    if (!pendingMsgRef.current || isLoading) return;
    const msg = pendingMsgRef.current;
    pendingMsgRef.current = null;
    append({ role: 'user', content: msg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Auto-save after AI finishes responding
  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length === 0) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveConversation(messages);
  }, [isLoading, messages, saveConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Switch to an existing chat
  function switchChat(chat: GoalChat) {
    setActiveChatId(chat.id);
    const msgs: Message[] = chat.messages.length
      ? chat.messages
      : (chat.id === `goal-${id}` && goal)
        ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }]
        : [];
    setMessages(msgs);
    savedLengthRef.current = msgs.length;
  }

  // Delete an extra chat (soft delete)
  async function deleteChat(chatId: string) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', chatId), { deleted: true });
    if (activeChatId === chatId) {
      const main = allChats.find(c => c.id === mainChatId);
      if (main) {
        switchChat(main);
      } else {
        setActiveChatId(mainChatId);
        const checkin: Message[] = goal ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }] : [];
        setMessages(checkin);
        savedLengthRef.current = 0;
      }
    }
  }

  // Start a new blank chat (user types first)
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

  // Tap a suggestion — creates a new chat and queues the first message
  async function tapSuggestion(text: string) {
    if (!user) return;
    const ref = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
      goalId: id, title: text, messages: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deleted: false,
    });
    setActiveChatId(ref.id);      // update ref synchronously
    savedLengthRef.current = 0;
    pendingMsgRef.current = text; // queue the message
    setMessages([]);              // reset → triggers the pendingMsg effect
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

  if (loading || !goal) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const mainChatId = `goal-${id}`;
  const isMainChat = activeChatId === mainChatId;
  const extraChats = allChats.filter(c => c.id !== mainChatId);
  const activeChat = allChats.find(c => c.id === activeChatId);
  const progressDisplay = editingProgress ? draftProgress : goal.progress;

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">

        {/* Back */}
        <button onClick={() => router.push('/goals')} className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors">
          ← Goals
        </button>

        {/* Header */}
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

        {/* Progress */}
        <GCard>
          <SectionLabel
            icon={<IconTarget />}
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
            <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${Math.min(100, progressDisplay)}%` }} />
          </div>
          <p className="text-sm text-text font-semibold">{progressDisplay}% complete</p>
          {editingProgress && (
            <div className="mt-4 space-y-3">
              <input type="range" min={0} max={100} step={5} value={draftProgress}
                onChange={e => setDraftProgress(Number(e.target.value))} className="w-full accent-brand" />
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={100} value={draftProgress}
                  onChange={e => setDraftProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-20 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text outline-none focus:border-brand" />
                <span className="text-sm text-muted">%</span>
                <button onClick={saveProgress} disabled={savingProgress}
                  className="ml-auto bg-brand text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60">
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

        {/* Linked tasks */}
        {linkedTasks.length > 0 && (
          <GCard>
            <SectionLabel icon={<IconCheck />} color="text-emerald-500" text="Linked tasks" />
            <div className="space-y-1.5">
              {linkedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 bg-bg rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                  <span className="text-[13px] text-text">{t.title}</span>
                </div>
              ))}
            </div>
          </GCard>
        )}

        {/* Explore */}
        <GCard>
          <SectionLabel icon={<IconSparkle />} color="text-brand" text="Explore this goal" />
          <p className="text-xs text-muted mb-3">Tap a question to open a dedicated chat thread.</p>
          {suggestionsLoading ? (
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-6 rounded-full bg-border animate-pulse" style={{ width: `${100 + i * 30}px` }} />
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button key={s} onClick={() => tapSuggestion(s)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted/50">No suggestions available.</p>
          )}
        </GCard>

        {/* Divider + chat tabs */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted uppercase tracking-widest">MODUS on this goal</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => {
                const main = allChats.find(c => c.id === mainChatId);
                if (main) switchChat(main);
                else {
                  setActiveChatId(mainChatId);
                  const checkin: Message[] = goal ? [{ id: `goal-checkin-${id}`, role: 'assistant' as const, content: checkinMessage(goal) }] : [];
                  setMessages(checkin);
                  savedLengthRef.current = 0;
                }
              }}
              className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                isMainChat ? 'bg-brand text-white border-brand' : 'border-border text-muted hover:text-text hover:border-brand/30'
              }`}
            >
              Main chat
            </button>

            {extraChats.map(c => (
              <div key={c.id} className={`shrink-0 flex items-center rounded-full border transition-colors ${
                activeChatId === c.id ? 'bg-brand border-brand' : 'border-border hover:border-brand/30'
              }`}>
                <button onClick={() => switchChat(c)} title={c.title}
                  className={`text-xs pl-3 pr-1.5 py-1 max-w-[120px] truncate ${
                    activeChatId === c.id ? 'text-white' : 'text-muted hover:text-text'
                  }`}>
                  {c.title.length > 20 ? c.title.slice(0, 17) + '…' : c.title}
                </button>
                <button onClick={e => { e.stopPropagation(); deleteChat(c.id); }}
                  title="Delete chat"
                  className={`pr-2.5 py-1 text-sm leading-none transition-colors ${
                    activeChatId === c.id ? 'text-white/60 hover:text-white' : 'text-muted/50 hover:text-muted'
                  }`}>
                  ×
                </button>
              </div>
            ))}

            <button onClick={startNewChat}
              className="shrink-0 text-xs px-3 py-1 rounded-full border border-dashed border-border text-muted hover:text-text hover:border-brand/40 transition-colors">
              + New
            </button>
          </div>

          {!isMainChat && activeChat && (
            <p className="text-[11px] text-muted mt-1.5 truncate">{activeChat.title}</p>
          )}
        </div>

        {/* Chat messages */}
        <div className="space-y-3">
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

        {/* Chat bar */}
        <GCard className="!p-0 overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <p className="text-xs font-semibold text-muted mb-0.5">Talk to MODUS about this goal</p>
            <p className="text-[11px] text-muted/60">Share a win, log progress, or ask for help.</p>
          </div>
          <div className="px-5 pb-3 border-t border-border pt-3 flex gap-1.5 flex-wrap">
            {CHAT_CHIPS.map(chip => (
              <button key={chip} onClick={() => setInput(chip)} disabled={isLoading}
                className="text-[11px] px-3 py-1 rounded-full border border-border text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-40">
                {chip}
              </button>
            ))}
          </div>
          <div className="border-t border-border">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-3">
              <input value={input} onChange={handleInputChange}
                placeholder={`What's happening with "${goal.title}"?`}
                className="flex-1 bg-transparent text-sm text-text placeholder:text-muted/40 outline-none border-none" />
              <button type="submit" disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-text flex items-center justify-center text-panel shrink-0 disabled:opacity-30 transition-opacity">
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
