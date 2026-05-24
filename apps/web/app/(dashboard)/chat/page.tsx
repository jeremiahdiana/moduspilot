'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import ConversationList from '@/components/chat/ConversationList';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import PaywallModal from '@/components/chat/PaywallModal';
import { doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Message } from 'ai';

const FREE_DAILY_LIMIT = 20;
const TRIAL_DAYS = 30;

type Plan = 'free' | 'modus' | 'pilot';

export default function ChatPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const isGuest = !uid;
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? undefined;

  const { conversations, loading, createConversation, saveMessages, deleteConversation, restoreConversation } = useConversations(uid);
  const { settings, loading: settingsLoading } = useUserSettings(user);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [plan, setPlan] = useState<Plan>('free');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(TRIAL_DAYS);
  const [connectedToast, setConnectedToast] = useState('');
  const initDone = useRef(false);
  const pendingConvIdRef = useRef<string | null>(null);
  const [inFlightMessages, setInFlightMessages] = useState<Message[]>([]);

  // Show toast when returning from OAuth with ?connected= param
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (!connected) return;
    const labels: Record<string, string> = { notion: 'Notion connected', slack: 'Slack connected', github: 'GitHub connected', google: 'Google connected' };
    setConnectedToast(labels[connected] ?? `${connected} connected`);
    window.history.replaceState({}, '', window.location.pathname);
    const t = setTimeout(() => setConnectedToast(''), 4000);
    return () => clearTimeout(t);
  }, [searchParams]);

  // Load active conversation from most recent on mount
  useEffect(() => {
    if (!loading && conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [loading, conversations, activeId]);

  // Once a pending new conversation appears in Firestore (with messages), activate it
  useEffect(() => {
    const pending = pendingConvIdRef.current;
    if (pending && conversations.find(c => c.id === pending)) {
      setActiveId(pending);
      pendingConvIdRef.current = null;
    }
  }, [conversations]);

  // Load user plan + daily message count + trial status
  useEffect(() => {
    if (!uid || initDone.current) return;
    initDone.current = true;

    const today = new Date().toISOString().slice(0, 10);

    // Use Firebase Auth creation time for trial calculation
    const creationTime = user?.metadata?.creationTime;
    if (creationTime) {
      const created = new Date(creationTime);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      setTrialDaysLeft(Math.max(0, TRIAL_DAYS - daysSinceCreation));
    }

    getDoc(doc(db, 'users', uid)).then(snap => {
      const data = snap.data() ?? {};
      const userPlan = data.plan as Plan | undefined;
      setPlan(userPlan === 'modus' || userPlan === 'pilot' ? userPlan : 'free');

      const lastDay = data.usageDate ?? '';
      if (lastDay === today) {
        setMsgCount(data.dailyMessages ?? 0);
      } else {
        setDoc(doc(db, 'users', uid), { usageDate: today, dailyMessages: 0 }, { merge: true });
        setMsgCount(0);
      }
    }).catch(() => {
      // Network unavailable on load — defaults (free plan, 0 messages) are fine
    });
  }, [uid, user]);

  const isPaid = plan === 'modus' || plan === 'pilot';
  const trialActive = trialDaysLeft > 0;
  // Limit only kicks in when trial expired AND not on paid plan
  const isAtLimit = !isPaid && !isGuest && !trialActive && msgCount >= FREE_DAILY_LIMIT;

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;

  // Clear in-flight messages once Firestore has confirmed the conversation has messages
  useEffect(() => {
    if (activeConversation?.messages?.length && inFlightMessages.length) {
      setInFlightMessages([]);
    }
  }, [activeConversation?.messages?.length, inFlightMessages.length]);

  const handleNew = useCallback(async () => {
    if (isGuest) { setActiveId(null); return; }
    const id = await createConversation();
    setActiveId(id);
  }, [isGuest, createConversation]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }, [deleteConversation, activeId, conversations]);

  const handleRestore = useCallback(async (id: string) => {
    await restoreConversation(id);
    setShowDeleted(false);
    setActiveId(id);
  }, [restoreConversation]);

  const handleMessagesChange = useCallback(async (messages: Message[], title?: string) => {
    if (isGuest || !uid) return;
    let convId = activeId ?? pendingConvIdRef.current;
    if (!convId) {
      convId = await createConversation();
      pendingConvIdRef.current = convId;
      setInFlightMessages(messages); // preserve messages across ChatWindow remount
    }
    await saveMessages(convId, messages, title);
  }, [isGuest, uid, activeId, createConversation, saveMessages]);

  const handleUserMessage = useCallback(async () => {
    if (isGuest || !uid) return;
    const today = new Date().toISOString().slice(0, 10);
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    await updateDoc(doc(db, 'users', uid), {
      dailyMessages: increment(1),
      usageDate: today,
    });
    if (!isPaid && !trialActive && newCount >= FREE_DAILY_LIMIT) {
      setShowPaywall(true);
    }
  }, [isGuest, isPaid, trialActive, msgCount, uid]);

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* OAuth connected toast */}
      {connectedToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
            <path d="M2 6l3 3 5-5" />
          </svg>
          {connectedToast}
        </div>
      )}
      {/* Conversation sidebar — signed in only */}
      {!isGuest && (
        <div className="w-52 shrink-0 border-r border-border flex flex-col py-4">
          <div className="px-3 mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Chats</span>
            <button
              onClick={() => setShowDeleted(s => !s)}
              className="text-xs text-muted hover:text-text transition-colors"
            >
              {showDeleted ? 'Active' : 'Trash'}
            </button>
          </div>

          {showDeleted ? (
            <DeletedList uid={uid} onRestore={handleRestore} restoreFn={restoreConversation} />
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={handleSelect}
              onNew={handleNew}
              onDelete={handleDelete}
            />
          )}

          {/* Plan / trial status */}
          {!isPaid && (
            <div className="px-3 pt-3 border-t border-border mt-auto">
              {trialActive ? (
                <>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{trialDaysLeft}d trial left</span>
                    <button onClick={() => setShowPaywall(true)} className="text-brand hover:underline">Upgrade</button>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((TRIAL_DAYS - trialDaysLeft) / TRIAL_DAYS) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{msgCount}/{FREE_DAILY_LIMIT} today</span>
                    <button onClick={() => setShowPaywall(true)} className="text-brand hover:underline">Upgrade</button>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all"
                      style={{ width: `${Math.min(100, (msgCount / FREE_DAILY_LIMIT) * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {isPaid && (
            <div className="px-3 pt-3 border-t border-border mt-auto">
              <p className="text-xs text-brand font-semibold uppercase tracking-wider">{plan === 'pilot' ? 'Pilot' : 'Modus'}</p>
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
          {isGuest && (
            <button onClick={handleNew} className="text-xs bg-panel border border-border px-3 py-1.5 rounded-lg text-muted hover:text-text transition-colors">
              + New chat
            </button>
          )}
          <h1 className="text-sm font-semibold text-text truncate">
            {activeConversation?.title ?? 'Modus Pilot'}
          </h1>
          {isGuest && (
            <span className="ml-auto text-xs text-muted shrink-0">
              <a href="/login" className="text-brand hover:underline">Sign in</a> to save
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Wait until activeId is settled so ChatWindow doesn't remount with a key change */}
          {!isGuest && (loading || settingsLoading || (conversations.length > 0 && !activeId)) ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <ChatWindow
            key={activeId ?? 'guest'}
            conversationId={activeId}
            initialMessages={activeConversation?.messages?.length ? activeConversation.messages : inFlightMessages}
            initialInput={initialQuery}
            onMessagesChange={isGuest ? undefined : handleMessagesChange}
            onUserMessage={handleUserMessage}
            isGuest={isGuest}
            isAtLimit={isAtLimit}
            onShowPaywall={() => setShowPaywall(true)}
            personalContext={settings.personalContext}
            responseStyle={settings.responseStyle}
            customStyle={settings.customStyle}
            briefingHour={settings.briefingHour}
            briefingTimezone={settings.briefingTimezone}
          />
          )}
        </div>
      </div>

      {showPaywall && (
        <PaywallModal onClose={() => setShowPaywall(false)} />
      )}
    </div>
  );
}

function DeletedList({ uid, onRestore, restoreFn }: {
  uid: string | null;
  onRestore: (id: string) => void;
  restoreFn: (id: string) => Promise<void>;
}) {
  const [deleted, setDeleted] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!uid) return;
    let unsub: (() => void) | undefined;
    import('firebase/firestore').then(({ collection, query, where, orderBy, onSnapshot }) => {
      const q = query(
        collection(db, 'users', uid, 'conversations'),
        where('deleted', '==', true),
        orderBy('updatedAt', 'desc'),
      );
      unsub = onSnapshot(q, snap => {
        setDeleted(snap.docs.map(d => ({ id: d.id, title: d.data().title || 'Untitled' })));
      });
    });
    return () => unsub?.();
  }, [uid]);

  if (deleted.length === 0) {
    return <p className="text-xs text-muted text-center py-6 px-3">No deleted chats.</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
      {deleted.map(d => (
        <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg group">
          <span className="flex-1 text-sm text-muted truncate">{d.title}</span>
          <button
            onClick={async () => { await restoreFn(d.id); onRestore(d.id); }}
            className="text-xs text-brand opacity-0 group-hover:opacity-100 transition-all"
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
