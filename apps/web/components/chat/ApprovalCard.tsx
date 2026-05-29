'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';

interface ApprovalPayload {
  type: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  create_project: 'New Project',
  create_goal: 'New Goal',
  create_task: 'New Task',
  create_habit: 'New Habit',
  schedule_event: 'Schedule Event',
  draft_email: 'Draft Email',
  update_goal: 'Update Goal',
  update_goal_progress: 'Goal Progress',
  update_task: 'Update Task',
  update_habit: 'Update Habit',
  delete_task: 'Delete Task',
  delete_habit: 'Delete Habit',
  delete_goal: 'Delete Goal',
  create_goal_chat: 'New Goal Chat',
  delete_goal_chat: 'Delete Chat',
  create_project_chat: 'New Project Chat',
  delete_project_chat: 'Delete Chat',
  connect_google: 'Connect Google',
  connect_notion: 'Connect Notion',
  connect_slack: 'Connect Slack',
  connect_github: 'Connect GitHub',
  enable_web_search: 'Enable Web Search',
  send_email: 'Send Email',
  reschedule_event: 'Reschedule Event',
  archive_email: 'Archive Email',
  mark_read_email: 'Mark as Read',
};

const CONNECT_ENDPOINTS: Record<string, string> = {
  connect_google: '/api/auth/google/connect',
  connect_notion: '/api/auth/notion/connect',
  connect_slack: '/api/auth/slack/connect',
  connect_github: '/api/auth/github/connect',
};

const REDIRECT_TYPES = new Set(Object.keys(CONNECT_ENDPOINTS));

const spring = { type: 'spring', stiffness: 300, damping: 26 } as const;
const springFast = { type: 'spring', stiffness: 420, damping: 28 } as const;

// Module-level counter gives each card instance a unique index within the page session,
// preventing duplicate cards (e.g. two habits with the same name) from sharing a storage key.
let _cardCount = 0;

export default function ApprovalCard({ raw }: { raw: string }) {
  // Persist approved state so remounts (navigation, conversation switch) don't reset to pending
  const instanceId = useMemo(() => ++_cardCount, []);
  const cardKey = useMemo(() => {
    try {
      const sig = raw.slice(0, 120) + '|' + instanceId;
      return 'mc-' + btoa(unescape(encodeURIComponent(sig))).slice(0, 32).replace(/[+/=]/g, '_');
    } catch { return ''; }
  }, [raw, instanceId]);

  const [status, setStatus] = useState<'pending' | 'editing' | 'approved' | 'dismissed'>(() => {
    try {
      if (typeof window !== 'undefined' && cardKey && sessionStorage.getItem(cardKey) === 'approved') return 'approved';
    } catch {}
    return 'pending';
  });

  useEffect(() => {
    if (status === 'approved' && cardKey) {
      try { sessionStorage.setItem(cardKey, 'approved'); } catch {}
    }
  }, [status, cardKey]);

  const [loading, setLoading] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedProgress, setEditedProgress] = useState(0);
  const [error, setError] = useState('');
  const [googleAccounts, setGoogleAccounts] = useState<{ email: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');

  let data: ApprovalPayload;
  try { data = JSON.parse(raw); } catch { return null; }

  useEffect(() => {
    if (data.type !== 'send_email') return;
    auth.currentUser?.getIdToken().then(async token => {
      try {
        const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        const accounts: { email: string }[] = d.accounts ?? [];
        setGoogleAccounts(accounts);
        const payloadAccount = data.payload?.from_account as string | undefined;
        setSelectedAccount(payloadAccount || accounts[0]?.email || '');
      } catch { /* non-fatal */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.type]);

  async function approve(title: string, overridePayload?: Record<string, unknown>) {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();

      if (REDIRECT_TYPES.has(data.type)) {
        const endpoint = CONNECT_ENDPOINTS[data.type];
        const isGoogle = data.type === 'connect_google';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(isGoogle ? {} : { origin: 'chat' }),
        });
        if (!res.ok) { setError('Failed to start connection.'); return; }
        const { url } = await res.json();
        if (url) window.location.href = url;
        return;
      }

      const basePayload = data.payload && Object.keys(data.payload).length > 0
        ? data.payload
        : Object.fromEntries(Object.entries(data).filter(([k]) => !['type', 'title', 'description'].includes(k)));

      const emailOverride = data.type === 'send_email' && selectedAccount
        ? { from_account: selectedAccount }
        : {};

      const payload = { ...basePayload, ...(overridePayload ?? {}), ...emailOverride };

      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: data.type, title, description: data.description, payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? 'Something went wrong. Try again.';
        setError(msg.includes('not connected') ? 'Reconnect Google in Settings → Integrations to send emails.' : msg);
        return;
      }
      setStatus('approved');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const isEmailType = data.type === 'send_email' || data.type === 'draft_email';
  const emailSubject = data.payload?.subject ? String(data.payload.subject) : null;
  const emailTo = data.payload?.to ? String(data.payload.to) : null;
  const confirmedLabel = data.type === 'send_email'
    ? `Sent${emailSubject ? `: ${emailSubject}` : ''}`
    : data.type === 'draft_email'
    ? `Draft saved${emailSubject ? `: ${emailSubject}` : ''}`
    : `${editedTitle || data.title} — done`;
  const pendingProgress = typeof data.payload?.progress === 'number' ? data.payload.progress : 0;
  const isConnectCard = REDIRECT_TYPES.has(data.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
    >
      <AnimatePresence mode="wait">
        {/* ── Approved ── */}
        {status === 'approved' && (
          <motion.div
            key="approved"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={spring}
            className="border border-brand/30 bg-brand/5 rounded-xl px-4 py-3 space-y-1"
          >
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-brand shrink-0">
                <motion.path
                  d="M2 6l3 3 5-5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
                />
              </svg>
              <span className="text-sm text-brand">{confirmedLabel}</span>
            </div>
            {isEmailType && emailTo && (
              <p className="text-xs text-muted pl-5">To: {emailTo}</p>
            )}
          </motion.div>
        )}

        {/* ── Dismissed ── */}
        {status === 'dismissed' && (
          <motion.div
            key="dismissed"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
            className="border border-border rounded-xl px-4 py-3 text-sm text-muted line-through"
          >
            {data.title}
          </motion.div>
        )}

        {/* ── Editing ── */}
        {status === 'editing' && (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={spring}
            className="border border-border bg-panel rounded-xl px-4 py-4 space-y-3"
          >
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">
                {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
              </p>
              {data.type === 'update_goal_progress' ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-text">{data.title}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Progress</span>
                      <span className="text-sm font-semibold text-brand">{editedProgress}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={editedProgress}
                      onChange={e => setEditedProgress(Number(e.target.value))} className="w-full accent-brand" />
                  </div>
                </div>
              ) : (
                <>
                  <input autoFocus value={editedTitle} onChange={e => setEditedTitle(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-brand transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter') approve(editedTitle); if (e.key === 'Escape') setStatus('pending'); }} />
                  <p className="text-xs text-muted mt-1.5">{data.description}</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => data.type === 'update_goal_progress' ? approve(data.title, { progress: editedProgress }) : approve(editedTitle)}
                disabled={loading || (data.type !== 'update_goal_progress' && !editedTitle.trim())}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.97 } : {}}
                transition={springFast}
                className="flex-1 bg-brand text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Confirm'}
              </motion.button>
              <motion.button
                onClick={() => setStatus('pending')}
                whileTap={{ scale: 0.97 }}
                transition={springFast}
                className="px-4 bg-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text transition-colors"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Pending ── */}
        {status === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="border border-brand/15 bg-panel rounded-xl px-4 py-4 space-y-3 shadow-[inset_0_0_32px_rgba(124,58,237,0.04)]"
          >
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">
                {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
              </p>
              <p className="text-sm font-semibold text-text">{data.title}</p>
              {data.type === 'update_goal_progress' ? (
                <div className="mt-2 space-y-1.5">
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brand rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pendingProgress}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 }}
                    />
                  </div>
                  <p className="text-xs text-muted">{pendingProgress}% complete</p>
                </div>
              ) : (data.type === 'send_email' || data.type === 'draft_email') ? (() => {
                const eTo = data.payload?.to ? String(data.payload.to) : null;
                const eSubject = data.payload?.subject ? String(data.payload.subject) : data.title;
                const eBody = data.payload?.body ? String(data.payload.body) : null;
                return (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {eTo && <p><span className="text-text/60 font-medium">To:</span> {eTo}</p>}
                    {eSubject && <p><span className="text-text/60 font-medium">Subject:</span> {eSubject}</p>}
                    {eBody && (
                      <div className="mt-2 bg-bg rounded-lg p-2.5 border border-border whitespace-pre-wrap text-[11px] text-text/80 max-h-36 overflow-y-auto">
                        {eBody}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <p className="text-xs text-muted mt-0.5">{data.description}</p>
              )}

              {data.type === 'send_email' && googleAccounts.length > 1 && (
                <div className="mt-2">
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Send from</label>
                  <select
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-brand transition-colors"
                  >
                    {googleAccounts.map(a => (
                      <option key={a.email} value={a.email}>{a.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <motion.button
                onClick={() => approve(data.title)}
                disabled={loading}
                whileHover={!loading ? { scale: 1.03, y: -1 } : {}}
                whileTap={!loading ? { scale: 0.97 } : {}}
                transition={springFast}
                className="btn-primary flex-1 text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? (isConnectCard ? 'Redirecting...' : 'Saving...') : (isConnectCard ? 'Connect' : 'Approve')}
              </motion.button>
              {!isConnectCard && (
                <motion.button
                  onClick={() => { setEditedTitle(data.title); setEditedProgress(pendingProgress); setStatus('editing'); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springFast}
                  className="flex-1 border border-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text hover:border-brand/50 transition-colors"
                >
                  Edit
                </motion.button>
              )}
              <motion.button
                onClick={() => setStatus('dismissed')}
                whileTap={{ scale: 0.97 }}
                transition={springFast}
                className="flex-1 bg-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text transition-colors"
              >
                Skip
              </motion.button>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400 mt-1"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
