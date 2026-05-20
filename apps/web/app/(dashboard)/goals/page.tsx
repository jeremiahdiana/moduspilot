'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';

type Timeframe = 'short' | 'long';
type GoalStatus = 'active' | 'completed' | 'deleted';

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: GoalStatus;
  dueDate?: string;
  timeframe?: Timeframe;
}

const TF: Record<Timeframe, { label: string; sublabel: string; color: string; badge: string }> = {
  short: { label: 'Short term', sublabel: 'Under 1 year',    color: 'text-blue-500',  badge: 'bg-blue-500/10 text-blue-500' },
  long:  { label: 'Long term',  sublabel: 'More than 1 year', color: 'text-brand',     badge: 'bg-brand/10 text-brand' },
};

interface GoalForm {
  title: string;
  description: string;
  timeframe: Timeframe;
  dueDate: string;
}

const EMPTY_FORM: GoalForm = { title: '', description: '', timeframe: 'short', dueDate: '' };

export default function GoalsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed' | 'trash'>('active');
  const [collapsed, setCollapsed] = useState<Record<Timeframe, boolean>>({ short: false, long: false });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 3-dot menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'goals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Untitled',
        description: d.data().description,
        progress: d.data().progress ?? 0,
        status: (d.data().status as GoalStatus) ?? 'active',
        dueDate: d.data().dueDate,
        timeframe: d.data().timeframe as Timeframe | undefined,
      })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function openAdd() {
    setEditingGoal(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(g: Goal) {
    setEditingGoal(g);
    setForm({
      title: g.title,
      description: g.description ?? '',
      timeframe: g.timeframe ?? 'short',
      dueDate: g.dueDate ?? '',
    });
    setMenuOpen(null);
    setModalOpen(true);
  }

  async function saveGoal() {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      timeframe: form.timeframe,
      dueDate: form.dueDate || null,
    };
    if (editingGoal) {
      await updateDoc(doc(db, 'users', user.uid, 'goals', editingGoal.id), payload);
    } else {
      await addDoc(collection(db, 'users', user.uid, 'goals'), {
        ...payload,
        status: 'active',
        progress: 0,
        source: 'manual',
        createdAt: serverTimestamp(),
      });
    }
    setSaving(false);
    setModalOpen(false);
  }

  async function softDelete(g: Goal) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', g.id), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    });
    setConfirmDelete(null);
    setMenuOpen(null);
  }

  async function restore(g: Goal) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', g.id), { status: 'active' });
  }

  async function setTimeframe(goalId: string, timeframe: Timeframe) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), { timeframe });
  }

  const active    = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const deleted   = goals.filter(g => g.status === 'deleted');
  const uncat     = active.filter(g => !g.timeframe);

  return (
    <div className="p-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Goals</h1>
          <p className="text-muted text-sm mt-1">Track what you&apos;re working toward.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand/90 transition-colors shrink-0"
        >
          <span className="text-base leading-none">+</span> Add goal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-panel border border-border rounded-lg p-1 w-fit">
        {([
          { key: 'active',    label: 'Active' },
          { key: 'completed', label: 'Completed' },
          { key: 'trash',     label: 'Trash' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
            {t.key === 'trash' && deleted.length > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
                {deleted.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'active' ? (
        <div className="space-y-8 max-w-2xl">
          {/* Uncategorized */}
          {uncat.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Needs categorizing</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-border text-muted">{uncat.length}</span>
              </div>
              <div className="space-y-2">
                {uncat.map(g => (
                  <div key={g.id} className="bg-panel border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-text">{g.title}</p>
                        {g.description && <p className="text-xs text-muted mt-0.5">{g.description}</p>}
                      </div>
                      <GoalMenu g={g} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef}
                        onEdit={() => openEdit(g)} onDelete={() => setConfirmDelete(g)} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted">Set timeframe:</span>
                      {(Object.keys(TF) as Timeframe[]).map(key => (
                        <button
                          key={key}
                          onClick={e => { e.stopPropagation(); setTimeframe(g.id, key); }}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-bg hover:border-current transition-colors ${TF[key].color}`}
                        >
                          {TF[key].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted text-sm">No active goals yet.</p>
              <button onClick={openAdd} className="mt-3 text-sm text-brand hover:underline">Add your first goal</button>
            </div>
          )}

          {(Object.keys(TF) as Timeframe[]).map(key => {
            const tfGoals = active.filter(g => g.timeframe === key);
            if (tfGoals.length === 0) return null;
            const isCollapsed = collapsed[key];
            return (
              <div key={key}>
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
                  className="flex items-center gap-2 mb-3 w-full text-left group"
                >
                  <span className={`text-xs font-semibold uppercase tracking-widest ${TF[key].color}`}>{TF[key].label}</span>
                  <span className="text-[11px] text-muted">{TF[key].sublabel}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-border text-muted ml-1">{tfGoals.length}</span>
                  <span className="ml-auto text-xs text-muted group-hover:text-text transition-colors">
                    {isCollapsed ? '▾' : '▴'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {tfGoals.map(g => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        tfKey={key}
                        menuOpen={menuOpen}
                        setMenuOpen={setMenuOpen}
                        menuRef={menuRef}
                        onClick={() => router.push(`/goals/${g.id}`)}
                        onEdit={() => openEdit(g)}
                        onDelete={() => setConfirmDelete(g)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      ) : tab === 'completed' ? (
        <div className="space-y-3 max-w-2xl">
          {completed.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted text-sm">No completed goals yet.</p>
            </div>
          ) : completed.map(g => (
            <div
              key={g.id}
              onClick={() => router.push(`/goals/${g.id}`)}
              className="bg-panel border border-border rounded-xl p-5 cursor-pointer hover:border-brand/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-text/60 line-through">{g.title}</p>
                  {g.description && <p className="text-sm text-muted mt-0.5">{g.description}</p>}
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                  Complete
                </span>
              </div>
            </div>
          ))}
        </div>

      ) : (
        /* Trash */
        <div className="space-y-3 max-w-2xl">
          {deleted.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted text-sm">Trash is empty.</p>
            </div>
          ) : deleted.map(g => (
            <div key={g.id} className="bg-panel border border-border rounded-xl p-5 opacity-60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-text line-through">{g.title}</p>
                  {g.description && <p className="text-sm text-muted mt-0.5">{g.description}</p>}
                </div>
                <button
                  onClick={() => restore(g)}
                  className="text-xs text-brand hover:underline shrink-0"
                >
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-text">
                {editingGoal ? 'Edit goal' : 'Add goal'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text transition-colors">✕</button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Title *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="What do you want to achieve?"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Description <span className="normal-case font-normal">(optional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Why does this matter to you?"
                  rows={2}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors resize-none"
                />
              </div>

              {/* Timeframe */}
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Timeframe</label>
                <div className="flex gap-2">
                  {(Object.keys(TF) as Timeframe[]).map(key => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, timeframe: key }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.timeframe === key
                          ? key === 'short'
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
                            : 'bg-brand/10 border-brand/50 text-brand'
                          : 'border-border bg-bg text-muted hover:text-text'
                      }`}
                    >
                      <span className="block text-sm">{TF[key].label}</span>
                      <span className="block text-[10px] font-normal opacity-70">{TF[key].sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">
                  Due date <span className="normal-case font-normal">(optional — encouraged)</span>
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveGoal}
                disabled={!form.title.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingGoal ? 'Save changes' : 'Add goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-panel border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-text mb-2">Delete goal?</h2>
            <p className="text-sm text-muted mb-5">
              &ldquo;{confirmDelete.title}&rdquo; will move to trash. You can restore it anytime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => softDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Goal row card ─────────────────────────────────────────────────────────────

function GoalRow({
  goal, tfKey, menuOpen, setMenuOpen, menuRef, onClick, onEdit, onDelete,
}: {
  goal: Goal;
  tfKey: Timeframe;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-panel border border-border rounded-xl p-5 cursor-pointer hover:border-brand/30 transition-colors group relative"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text truncate group-hover:text-brand transition-colors">{goal.title}</p>
          {goal.description && <p className="text-sm text-muted mt-0.5 truncate">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {goal.dueDate && <span className="text-xs text-muted">{goal.dueDate}</span>}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TF[tfKey].badge}`}>
            {TF[tfKey].label}
          </span>
          <GoalMenu g={goal} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef}
            onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.min(100, goal.progress)}%` }} />
      </div>
      <span className="text-xs text-muted mt-1.5 block">{goal.progress}% complete</span>
    </div>
  );
}

// ── 3-dot menu ────────────────────────────────────────────────────────────────

function GoalMenu({
  g, menuOpen, setMenuOpen, menuRef, onEdit, onDelete,
}: {
  g: Goal;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="relative shrink-0"
      ref={menuOpen === g.id ? menuRef as React.RefObject<HTMLDivElement> : undefined}
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === g.id ? null : g.id); }}
        className="w-6 h-6 flex items-center justify-center text-muted hover:text-text rounded transition-colors opacity-0 group-hover:opacity-100"
      >
        ···
      </button>
      {menuOpen === g.id && (
        <div className="absolute right-0 top-7 z-50 bg-panel border border-border rounded-xl overflow-hidden shadow-lg w-32">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-bg transition-colors text-left"
          >
            <span className="text-xs">✎</span> Edit
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/10 transition-colors text-left border-t border-border"
          >
            <span className="text-xs">✕</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}
