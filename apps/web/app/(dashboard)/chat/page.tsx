'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import ConversationList from '@/components/chat/ConversationList';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import PaywallModal from '@/components/chat/PaywallModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Message } from 'ai';

type Plan = 'free' | 'modus' | 'pilot';

export default function ChatPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const isGuest = !uid;
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? undefined;

  const { conversations, loading, createConversation, saveMessages, renameConversation, deleteConversation, restoreConversation } = useConversations(uid);
  const { settings, loading: settingsLoading } = useUserSettings(user);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [grandfathered, setGrandfathered] = useState(false);
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

  // Load user plan + access status (subscription or grandfathered)
  useEffect(() => {
    if (!uid || initDone.current) return;
    initDone.current = true;

    getDoc(doc(db, 'users', uid)).then(snap => {
      const data = snap.data() ?? {};
      const userPlan = data.plan as Plan | undefined;
      setPlan(userPlan === 'modus' || userPlan === 'pilot' ? userPlan : 'free');
      // Grandfathered = account predates the paywall launch (permanent free access).
      setGrandfathered(data.grandfathered === true);
    }).catch(() => {
      // Network unavailable on load — defaults (free plan, no access) are fine
    });
  }, [uid, user]);

  // Trialing subscriptions set plan='modus' via the Stripe webhook, so paid
  // covers the 3-day trial too. Grandfathered accounts keep permanent access.
  const isPaid = plan === 'modus' || plan === 'pilot';
  const hasAccess = isPaid || grandfathered;
  // No subscription and not grandfathered → must start a trial before chatting.
  const needsSubscription = !hasAccess && !isGuest;

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
      setActiveId(convId); // set immediately so spinner never shows when Firestore confirms
      setInFlightMessages(messages);
    }
    await saveMessages(convId, messages, title);
  }, [isGuest, uid, activeId, createConversation, saveMessages]);

  // Access is server-authoritative: the API returns subscription_required (402)
  // and the composer opens the paywall via onShowPaywall. Nothing to track here.
  const handleUserMessage = useCallback(() => {}, []);

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
              onRename={renameConversation}
              user={user}
            />
          )}

          {/* No subscription — prompt to start the trial */}
          {needsSubscription && (
            <div className="px-3 pt-3 border-t border-border mt-auto">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Trial not started</span>
                <button onClick={() => setShowPaywall(true)} className="text-brand hover:underline">Start trial</button>
              </div>
              <p className="text-[11px] text-muted/70 leading-snug">Start your 3-day free trial to use MODUS.</p>
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
          {!isGuest && activeConversation && editingHeader ? (
            <input
              autoFocus
              value={headerTitle}
              onChange={e => setHeaderTitle(e.target.value)}
              onBlur={() => { renameConversation(activeConversation.id, headerTitle); setEditingHeader(false); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { renameConversation(activeConversation.id, headerTitle); setEditingHeader(false); }
                if (e.key === 'Escape') setEditingHeader(false);
              }}
              className="flex-1 text-sm font-semibold text-text bg-transparent border-b border-brand outline-none min-w-0"
            />
          ) : (
            <h1
              className={`text-sm font-semibold text-text truncate ${!isGuest && activeConversation ? 'cursor-pointer hover:text-brand transition-colors' : ''}`}
              title={!isGuest && activeConversation ? 'Click to rename' : undefined}
              onClick={() => {
                if (!isGuest && activeConversation) {
                  setHeaderTitle(activeConversation.title);
                  setEditingHeader(true);
                }
              }}
            >
              {activeConversation?.title ?? 'Modus Pilot'}
            </h1>
          )}
          {isGuest && (
            <span className="ml-auto text-xs text-muted shrink-0">
              <a href="/login" className="text-brand hover:underline">Sign in</a> to save
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Wait until activeId is settled so ChatWindow doesn't remount with a key change */}
          {!isGuest && (loading || settingsLoading || (conversations.length > 0 && !activeId)) ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-xs text-muted">Loading your chat…</p>
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
            isAtLimit={needsSubscription}
            onShowPaywall={() => setShowPaywall(true)}
            personalContext={settings.personalContext}
            responseStyle={settings.responseStyle}
            customStyle={settings.customStyle}
            briefingHour={settings.briefingHour}
            briefingTimezone={settings.briefingTimezone}
            plan={plan}
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
