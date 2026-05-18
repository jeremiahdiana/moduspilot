'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  const { conversations, loading, createConversation, saveMessages, deleteConversation, restoreConversation } = useConversations(uid);
  const { settings } = useUserSettings(user);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [plan, setPlan] = useState<Plan>('free');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(TRIAL_DAYS);
  const initDone = useRef(false);
  const pendingConvIdRef = useRef<string | null>(null);

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
      // Don't setActiveId yet — wait for Firestore to confirm the conversation
      // with messages before remounting ChatWindow (avoids flash of empty chat).
      pendingConvIdRef.current = convId;
    }
    await saveMessages(convId, messages, title);
  }, [isGuest, uid, activeId, createConversation, saveMessages]);

  const handleUserMessage = useCallback(async () => {
    if (isGuest || isPaid || trialActive) return;
    const today = new Date().toISOString().slice(0, 10);
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    if (uid) {
      await updateDoc(doc(db, 'users', uid), {
        dailyMessages: increment(1),
        usageDate: today,
      });
    }
    if (newCount >= FREE_DAILY_LIMIT) {
      setShowPaywall(true);
    }
  }, [isGuest, isPaid, trialActive, msgCount, uid]);

  return (
    <div className="flex h-full overflow-hidden">
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
          {loading && !isGuest ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <ChatWindow
            key={activeId ?? 'guest'}
            conversationId={activeId}
            initialMessages={activeConversation?.messages ?? []}
            onMessagesChange={isGuest ? undefined : handleMessagesChange}
            onUserMessage={handleUserMessage}
            isGuest={isGuest}
            isAtLimit={isAtLimit}
            onShowPaywall={() => setShowPaywall(true)}
            personalContext={settings.personalContext}
            responseStyle={settings.responseStyle}
            customStyle={settings.customStyle}
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
