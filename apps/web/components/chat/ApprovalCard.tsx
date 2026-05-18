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
  delete_task: 'Delete Task',
  delete_habit: 'Delete Habit',
  delete_goal: 'Delete Goal',
};

export default function ApprovalCard({ raw }: { raw: string }) {
  const [status, setStatus] = useState<'pending' | 'editing' | 'approved' | 'dismissed'>('pending');
  const [loading, setLoading] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [error, setError] = useState('');

  let data: ApprovalPayload;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  async function approve(title: string) {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: data.type,
          title,
          description: data.description,
          payload: data.payload,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Something went wrong. Try again.');
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
        <span className="text-brand text-xs">✓</span>
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
    return (
      <div className="border border-border bg-panel rounded-xl px-4 py-4 space-y-3">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-2">
            {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
          </p>
          <input
            autoFocus
            value={editedTitle}
            onChange={e => setEditedTitle(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-brand transition-colors"
            onKeyDown={e => { if (e.key === 'Enter') approve(editedTitle); if (e.key === 'Escape') setStatus('pending'); }}
          />
          <p className="text-xs text-muted mt-1.5">{data.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => approve(editedTitle)}
            disabled={loading || !editedTitle.trim()}
            className="flex-1 bg-brand text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Confirm'}
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

  return (
    <div className="border border-border bg-panel rounded-xl px-4 py-4 space-y-3">
      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-1">
          {TYPE_LABELS[data.type] ?? data.type.replace(/_/g, ' ')}
        </p>
        <p className="text-sm font-semibold text-text">{data.title}</p>
        <p className="text-xs text-muted mt-0.5">{data.description}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => approve(data.title)}
          disabled={loading}
          className="flex-1 bg-brand text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Approve'}
        </button>
        <button
          onClick={() => { setEditedTitle(data.title); setStatus('editing'); }}
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
