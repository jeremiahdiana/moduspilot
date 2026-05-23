'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

interface ApprovalPayload {
  type: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  create_goal: 'New Goal',
  create_task: 'New Task',
  create_habit: 'New Habit',
  schedule_event: 'Schedule Event',
  draft_email: 'Draft Email',
  update_goal: 'Update Goal',
  update_goal_progress: 'Goal Progress',
  delete_task: 'Delete Task',
  delete_habit: 'Delete Habit',
  delete_goal: 'Delete Goal',
  create_goal_chat: 'New Goal Chat',
  delete_goal_chat: 'Delete Chat',
  connect_google: 'Connect Google',
  enable_web_search: 'Enable Web Search',
  send_email: 'Send Email',
};

// Types that redirect to OAuth or a settings flow instead of POSTing to /api/approval
const REDIRECT_TYPES = new Set(['connect_google']);

export default function ApprovalCard({ raw }: { raw: string }) {
  const [status, setStatus] = useState<'pending' | 'editing' | 'approved' | 'dismissed'>('pending');
  const [loading, setLoading] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedProgress, setEditedProgress] = useState(0);
  const [error, setError] = useState('');

  let data: ApprovalPayload;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  async function approve(title: string, overridePayload?: Record<string, unknown>) {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();

      // OAuth / redirect-based actions
      if (REDIRECT_TYPES.has(data.type)) {
        const res = await fetch('/api/auth/google/connect', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setError('Failed to start Google connection.'); return; }
        const { url } = await res.json();
        if (url) window.location.href = url;
        return;
      }

      // If MODUS puts fields at top level instead of inside payload, hoist them
      const basePayload = data.payload && Object.keys(data.payload).length > 0
        ? data.payload
        : Object.fromEntries(
            Object.entries(data).filter(([k]) => !['type', 'title', 'description'].includes(k))
          );

      const payload = overridePayload ? { ...basePayload, ...overridePayload } : basePayload;

      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: data.type,
          title,
          description: data.description,
          payload,
        }),
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

  if (status === 'approved') {
    return (
      <div className="border border-brand/30 bg-brand/5 rounded-xl px-4 py-3 flex items-center gap-2">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-brand shrink-0">
          <path d="M2 6l3 3 5-5" />
        </svg>
        <span className="text-sm text-brand">{editedTitle || data.title} — done</span>
      </div>
    );
  }

  if (status === 'dismissed') {
    return (
      <div className="border border-border rounded-xl px-4 py-3 text-sm text-muted line-through">
        {data.title}
      </div>
    );
  }

  if (status === 'editing') {
    const isProgress = data.type === 'update_goal_progress';
    return (
      <div className="border border-border bg-panel rounded-xl px-4 py-4 space-y-3">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-2">
            {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
          </p>
          {isProgress ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-text">{data.title}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Progress</span>
                  <span className="text-sm font-semibold text-brand">{editedProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editedProgress}
                  onChange={e => setEditedProgress(Number(e.target.value))}
                  className="w-full accent-brand"
                />
              </div>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-brand transition-colors"
                onKeyDown={e => { if (e.key === 'Enter') approve(editedTitle); if (e.key === 'Escape') setStatus('pending'); }}
              />
              <p className="text-xs text-muted mt-1.5">{data.description}</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => isProgress
              ? approve(data.title, { progress: editedProgress })
              : approve(editedTitle)
            }
            disabled={loading || (!isProgress && !editedTitle.trim())}
            className="flex-1 bg-brand text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
          <button
            onClick={() => setStatus('pending')}
            className="px-4 bg-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const pendingProgress = typeof data.payload?.progress === 'number' ? data.payload.progress : 0;

  return (
    <div className="border border-border bg-panel rounded-xl px-4 py-4 space-y-3">
      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-1">
          {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
        </p>
        <p className="text-sm font-semibold text-text">{data.title}</p>
        {data.type === 'update_goal_progress' ? (
          <div className="mt-2 space-y-1.5">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pendingProgress}%` }} />
            </div>
            <p className="text-xs text-muted">{pendingProgress}% complete</p>
          </div>
        ) : (
          <p className="text-xs text-muted mt-0.5">{data.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => approve(data.title)}
          disabled={loading}
          className="flex-1 bg-brand text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Approve'}
        </button>
        <button
          onClick={() => {
            setEditedTitle(data.title);
            setEditedProgress(pendingProgress);
            setStatus('editing');
          }}
          className="flex-1 border border-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text hover:border-brand/50 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => setStatus('dismissed')}
          className="flex-1 bg-border text-muted text-xs font-semibold py-2 rounded-lg hover:text-text transition-colors"
        >
          Skip
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
