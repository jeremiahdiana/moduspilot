'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import ApprovalCard from '@/components/chat/ApprovalCard';

// MODUS's proactive work, surfaced where it can actually be acted on.
// Source: `conversations` docs written by the Inngest jobs (inbox-triage,
// relationship-nurture, meeting-intelligence, …) — all tagged `system: true`,
// `read: false`, often carrying an ```approval block in the assistant message.

interface ProactiveItem {
  id: string;
  label: string;
  text: string;              // preamble, with the approval block stripped out
  approvalRaw: string | null; // the raw approval JSON, if the card is actionable
  createdAtMs: number;
}

const APPROVAL_RE = /```approval\n([\s\S]*?)```/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function labelFor(data: any, approvalType: string | null): string {
  if (approvalType === 'send_email' || approvalType === 'draft_email') return 'Reply';
  if (approvalType === 'schedule_event' || approvalType === 'reschedule_event') return 'Meeting';
  if (data.relationshipNudge) return 'Reconnect';
  if (data.meetingBrief) return 'Meeting brief';
  if (data.reflection) return 'Reflection';
  if (data.weeklyReview) return 'Weekly review';
  if (data.focusAlert) return 'Focus';
  return 'Heads up';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseConversation(id: string, data: any): ProactiveItem | null {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assistant = [...messages].reverse().find((m: any) => m.role === 'assistant');
  const content: string = assistant?.content ?? '';
  if (!content) return null;

  const match = content.match(APPROVAL_RE);
  const approvalRaw = match ? match[1].trim() : null;

  let approvalType: string | null = null;
  if (approvalRaw) {
    try { approvalType = JSON.parse(approvalRaw).type ?? null; } catch { /* leave null */ }
  }

  const text = content
    .replace(/```approval\n[\s\S]*?```/, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return {
    id,
    label: labelFor(data, approvalType),
    text,
    approvalRaw,
    createdAtMs: data.createdAt?.toMillis?.() ?? 0,
  };
}

function ago(ms: number): string {
  if (!ms) return '';
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Strips simple **bold** markdown so the preamble reads as plain text in the feed.
function plain(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, '$1');
}

function ItemCard({ item, onDismiss }: { item: ProactiveItem; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="rounded-xl border border-border/60 bg-bg/40 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand bg-brand/10 rounded px-1.5 py-0.5 shrink-0">
            {item.label}
          </span>
          <span className="text-[11px] text-muted shrink-0">{ago(item.createdAtMs)}</span>
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-muted/60 hover:text-muted transition-colors shrink-0 -mr-1 p-1"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {item.text && (
        <p className="text-sm leading-relaxed text-text whitespace-pre-wrap mb-2.5">{plain(item.text)}</p>
      )}

      {item.approvalRaw ? (
        <ApprovalCard raw={item.approvalRaw} onApproved={() => onDismiss(item.id)} />
      ) : (
        <button
          onClick={() => onDismiss(item.id)}
          className="text-xs font-medium text-muted hover:text-text transition-colors"
        >
          Got it
        </button>
      )}
    </motion.div>
  );
}

interface GroupInvite {
  id: string;
  groupName: string;
  invitedByName: string | null;
}

export default function NeedsYou() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email?.toLowerCase() ?? null;
  const [items, setItems] = useState<ProactiveItem[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);

  useEffect(() => {
    if (!uid) return;
    // Single equality filter — no composite index required. We sort + filter `read`
    // client-side to keep this index-free (matches the project's Firestore convention).
    const q = query(collection(db, 'users', uid, 'conversations'), where('system', '==', true));
    const unsub = onSnapshot(
      q,
      snap => {
        const next: ProactiveItem[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.read === true || data.deleted === true) return;
          const item = parseConversation(d.id, data);
          if (item) next.push(item);
        });
        next.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setItems(next.slice(0, 6));
      },
      () => { /* non-fatal */ },
    );
    return unsub;
  }, [uid]);

  // Pending group invites addressed to this user (single equality filter).
  useEffect(() => {
    if (!email) return;
    const q = query(collection(db, 'groupInvites'), where('email', '==', email));
    const unsub = onSnapshot(
      q,
      snap => {
        setInvites(snap.docs
          .filter(d => d.data().status === 'pending')
          .map(d => ({ id: d.id, groupName: d.data().groupName ?? 'a group', invitedByName: d.data().invitedByName ?? null })));
      },
      () => { /* non-fatal */ },
    );
    return unsub;
  }, [email]);

  async function dismiss(id: string) {
    if (!uid) return;
    // Optimistic remove so the card leaves immediately on approve/skip.
    setItems(prev => prev.filter(i => i.id !== id));
    try { await updateDoc(doc(db, 'users', uid, 'conversations', id), { read: true }); } catch { /* non-fatal */ }
  }

  async function acceptInvite(id: string) {
    setInvites(prev => prev.filter(i => i.id !== id)); // optimistic
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/group/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteId: id }),
      });
    } catch { /* non-fatal — feed will re-sync */ }
  }

  if (items.length === 0 && invites.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5 rounded-2xl border border-brand/25 bg-brand/[0.04] overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <div className="w-6 h-6 rounded-md bg-brand/12 flex items-center justify-center text-brand shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-text">Needs you</span>
        <span className="text-[11px] font-medium text-brand bg-brand/10 rounded-full px-2 py-0.5 tabular-nums">
          {items.length + invites.length}
        </span>
        <span className="text-[11px] text-muted ml-auto hidden sm:block">MODUS worked while you were away</span>
      </div>

      <div className="px-3 pb-3 space-y-2">
        <AnimatePresence initial={false}>
          {invites.map(inv => (
            <motion.div
              key={inv.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="rounded-xl border border-border/60 bg-bg/40 px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand bg-brand/10 rounded px-1.5 py-0.5">Group invite</span>
              </div>
              <p className="text-sm leading-relaxed text-text mb-2.5">
                <span className="font-semibold">{inv.invitedByName ?? 'Someone'}</span> invited you to join{' '}
                <span className="font-semibold">{inv.groupName}</span>.
              </p>
              <button
                onClick={() => acceptInvite(inv.id)}
                className="text-xs font-semibold text-white bg-brand hover:bg-brand/90 rounded-lg px-3 py-1.5 transition-colors"
              >
                Join group
              </button>
            </motion.div>
          ))}
          {items.map(item => (
            <ItemCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
