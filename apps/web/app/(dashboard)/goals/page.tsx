'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, serverTimestamp, getDoc, setDoc, where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useChat } from 'ai/react';
import type { Message } from 'ai';

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

interface LinkedTask {
  id: string;
  title: string;
}

const TF: Record<Timeframe, { label: string; sublabel: string; color: string; badge: string }> = {
  short: { label: 'Short term', sublabel: 'Under 1 year',     color: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-500' },
  long:  { label: 'Long term',  sublabel: 'More than 1 year', color: 'text-brand',    badge: 'bg-brand/10 text-brand' },
};

interface GoalForm {
  title: string;
  description: string;
  timeframe: Timeframe;
  dueDate: string;
}

const EMPTY_FORM: GoalForm = { title: '', description: '', timeframe: 'short', dueDate: '' };

function checkinMessage(goal: Goal): string {
  if (goal.progress === 0)
    return `You're at 0% on "${goal.title}". What's the first move to get this started?`;
  if (goal.progress < 50)
    return `You're ${goal.progress}% into "${goal.title}". What's moved since you set this — and what's next?`;
  if (goal.progress < 100)
    return `You're ${goal.progress}% through "${goal.title}" — solid. What's left to get this across the line?`;
  return `"${goal.title}" is done. Want to capture any lessons before closing it out?`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { user } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed' | 'trash'>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
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

  function openAdd() {
    setEditingGoal(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(g: Goal) {
    setEditingGoal(g);
    setForm({ title: g.title, description: g.description ?? '', timeframe: g.timeframe ?? 'short', dueDate: g.dueDate ?? '' });
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
      const ref = await addDoc(collection(db, 'users', user.uid, 'goals'), {
        ...payload, status: 'active', progress: 0, source: 'manual', createdAt: serverTimestamp(),
      });
      setSelectedId(ref.id);
      setTab('active');
    }
    setSaving(false);
    setModalOpen(false);
  }

  async function softDelete(g: Goal) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', g.id), { status: 'deleted', deletedAt: serverTimestamp() });
    if (selectedId === g.id) setSelectedId(null);
    setConfirmDelete(null);
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
  const selectedGoal = goals.find(g => g.id === selectedId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Goals</h2>
          <button
            onClick={openAdd}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-panel transition-colors text-base leading-none"
            title="Add goal"
          >
            +
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-2 gap-0.5 pt-1.5">
          {([
            { key: 'active',    label: 'Active' },
            { key: 'completed', label: 'Done' },
            { key: 'trash',     label: 'Trash' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 pb-1.5 text-[11px] font-medium transition-colors ${
                tab === t.key ? 'text-brand border-b-2 border-brand' : 'text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.key === 'trash' && deleted.length > 0 && (
                <span className="ml-1 text-[9px] bg-muted/20 px-1 py-0.5 rounded-full">{deleted.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'active' ? (
            <>
              {uncat.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted/60">Uncategorized</p>
                  {uncat.map(g => <SidebarItem key={g.id} goal={g} selected={selectedId === g.id} onClick={() => setSelectedId(g.id)} />)}
                </div>
              )}
              {(['short', 'long'] as Timeframe[]).map(key => {
                const tfGoals = active.filter(g => g.timeframe === key);
                if (tfGoals.length === 0) return null;
                return (
                  <div key={key} className="mb-1">
                    <p className={`px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest ${TF[key].color}`}>
                      {TF[key].label}
                    </p>
                    {tfGoals.map(g => <SidebarItem key={g.id} goal={g} selected={selectedId === g.id} onClick={() => setSelectedId(g.id)} />)}
                  </div>
                );
              })}
              {active.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-muted">No active goals.</p>
                  <button onClick={openAdd} className="mt-2 text-xs text-brand hover:underline">Add one</button>
                </div>
              )}
            </>
          ) : tab === 'completed' ? (
            completed.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-xs text-muted">No completed goals.</p></div>
            ) : completed.map(g => <SidebarItem key={g.id} goal={g} selected={selectedId === g.id} onClick={() => setSelectedId(g.id)} />)
          ) : (
            deleted.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-xs text-muted">Trash is empty.</p></div>
            ) : deleted.map(g => <SidebarItem key={g.id} goal={g} selected={selectedId === g.id} onClick={() => setSelectedId(g.id)} />)
          )}
        </div>
      </aside>

      {/* ── Right panel ── */}
      {selectedGoal ? (
        <GoalPanel
          key={selectedGoal.id}
          goal={selectedGoal}
          onEdit={() => openEdit(selectedGoal)}
          onDelete={() => setConfirmDelete(selectedGoal)}
          onRestore={selectedGoal.status === 'deleted' ? () => restore(selectedGoal) : undefined}
          onTimeframe={(tf) => setTimeframe(selectedGoal.id, tf)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-muted text-sm">Select a goal, or add a new one.</p>
          <button onClick={openAdd} className="text-sm text-brand hover:underline">+ Add goal</button>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-panel border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-text">{editingGoal ? 'Edit goal' : 'Add goal'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text transition-colors">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Title *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveGoal(); }}
                  placeholder="What do you want to achieve?"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-brand transition-colors"
                />
              </div>
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
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Timeframe</label>
                <div className="flex gap-2">
                  {(Object.keys(TF) as Timeframe[]).map(key => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, timeframe: key }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.timeframe === key
                          ? key === 'short' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-brand/10 border-brand/50 text-brand'
                          : 'border-border bg-bg text-muted hover:text-text'
                      }`}
                    >
                      <span className="block">{TF[key].label}</span>
                      <span className="block text-[10px] font-normal opacity-70">{TF[key].sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-1.5">Due date <span className="normal-case font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-text transition-colors">
                Cancel
              </button>
              <button
                onClick={saveGoal}
                disabled={!form.title.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingGoal ? 'Save changes' : 'Add goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-panel border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-text mb-2">Delete goal?</h2>
            <p className="text-sm text-muted mb-5">&ldquo;{confirmDelete.title}&rdquo; will move to trash. You can restore it anytime.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-text transition-colors">
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

// ── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({ goal, selected, onClick }: { goal: Goal; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors ${
        selected ? 'bg-brand/10 border-r-2 border-brand' : 'hover:bg-panel'
      }`}
    >
      <p className={`text-xs font-medium truncate leading-snug ${selected ? 'text-brand' : 'text-text'}`}>
        {goal.title}
      </p>
      {goal.status === 'active' && (
        <div className="h-0.5 bg-border rounded-full mt-1.5 overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
        </div>
      )}
      {goal.status === 'completed' && <p className="text-[10px] text-emerald-500 mt-0.5">Complete</p>}
      {goal.status === 'deleted' && <p className="text-[10px] text-muted mt-0.5">Deleted</p>}
    </button>
  );
}

// ── Goal right panel ──────────────────────────────────────────────────────────

function GoalPanel({
  goal, onEdit, onDelete, onRestore, onTimeframe,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onTimeframe: (tf: Timeframe) => void;
}) {
  const { user } = useAuth();
  const { settings } = useUserSettings(user);

  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [editingProgress, setEditingProgress] = useState(false);
  const [draftProgress, setDraftProgress] = useState(goal.progress);
  const [savingProgress, setSavingProgress] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Message[]>([]);
  const [convLoaded, setConvLoaded] = useState(false);
  const savedLengthRef = useRef(0);
  const prevLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      setAuthToken(u ? await u.getIdToken() : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!editingProgress) setDraftProgress(goal.progress);
  }, [goal.progress, editingProgress]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'tasks'), where('done', '==', false), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const tasks = snap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, title: d.data().title ?? '' }))
        .filter(t => t.title.toLowerCase().includes(goal.title.toLowerCase().split(' ')[0]));
      setLinkedTasks(tasks.slice(0, 5));
    }, () => {});
    return unsub;
  }, [user, goal.title]);

  useEffect(() => {
    if (!user || convLoaded) return;
    const convId = `goal-${goal.id}`;
    getDoc(doc(db, 'users', user.uid, 'conversations', convId)).then(snap => {
      if (snap.exists()) {
        const msgs = snap.data().messages as Message[] ?? [];
        setConvMessages(msgs);
        savedLengthRef.current = msgs.length;
      }
      setConvLoaded(true);
    }).catch(() => setConvLoaded(true));
  }, [user, goal.id, convLoaded]);

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user) return;
    const convId = `goal-${goal.id}`;
    await setDoc(doc(db, 'users', user.uid, 'conversations', convId), {
      title: `Goal: ${goal.title}`,
      messages: msgs,
      updatedAt: new Date(),
      deleted: false,
      goalId: goal.id,
    }, { merge: true });
  }, [user, goal.id, goal.title]);

  const initialMessages: Message[] = convMessages.length > 0
    ? convMessages
    : [{ id: `goal-checkin-${goal.id}`, role: 'assistant', content: checkinMessage(goal) }];

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat',
    initialMessages,
    id: `goal-${goal.id}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '',
      responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '',
      goalContext: { id: goal.id, title: goal.title, description: goal.description, progress: goal.progress, timeframe: goal.timeframe },
    },
  });

  useEffect(() => {
    if (!convLoaded) return;
    setMessages(initialMessages);
    savedLengthRef.current = initialMessages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convLoaded]);

  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length === 0) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveConversation(messages);
  }, [isLoading, messages, saveConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function saveProgress() {
    if (!user) return;
    setSavingProgress(true);
    await updateDoc(doc(db, 'users', user.uid, 'goals', goal.id), {
      progress: draftProgress,
      ...(draftProgress >= 100 ? { status: 'completed' } : {}),
    });
    setSavingProgress(false);
    setEditingProgress(false);
  }

  async function markComplete() {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'goals', goal.id), { status: 'completed', progress: 100 });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim();
    setInput('');
    await append({ role: 'user', content: val });
  }

  const progressDisplay = editingProgress ? draftProgress : goal.progress;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {goal.timeframe && (
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-2 ${TF[goal.timeframe].badge}`}>
                {TF[goal.timeframe].label}
              </span>
            )}
            <h1 className="text-xl font-bold text-text leading-snug">{goal.title}</h1>
            {goal.description && <p className="text-sm text-muted mt-1">{goal.description}</p>}
            {goal.dueDate && <p className="text-xs text-muted mt-1">Due {goal.dueDate}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {onRestore ? (
              <button onClick={onRestore} className="text-xs text-brand hover:underline">Restore</button>
            ) : (
              <>
                <button onClick={onEdit} className="text-xs text-muted hover:text-text transition-colors">Edit</button>
                <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </>
            )}
          </div>
        </div>

        {/* Timeframe picker for uncategorized */}
        {!goal.timeframe && goal.status === 'active' && (
          <div className="bg-panel border border-border rounded-xl p-4">
            <p className="text-sm text-muted mb-3">Set a timeframe for this goal:</p>
            <div className="flex gap-2">
              {(Object.keys(TF) as Timeframe[]).map(key => (
                <button
                  key={key}
                  onClick={() => onTimeframe(key)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors border-border bg-bg hover:border-current ${TF[key].color}`}
                >
                  <span className="block">{TF[key].label}</span>
                  <span className="block text-[10px] font-normal opacity-60">{TF[key].sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {goal.status !== 'deleted' && (
          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Progress</span>
              {goal.status === 'active' && (
                <button onClick={() => setEditingProgress(e => !e)} className="text-xs text-brand hover:underline">
                  {editingProgress ? 'Cancel' : 'Update'}
                </button>
              )}
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${Math.min(100, progressDisplay)}%` }} />
            </div>
            <p className="text-sm text-text font-medium">{progressDisplay}% complete</p>

            {editingProgress && (
              <div className="mt-4 space-y-3">
                <input
                  type="range" min={0} max={100} step={5}
                  value={draftProgress}
                  onChange={e => setDraftProgress(Number(e.target.value))}
                  className="w-full accent-brand"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="number" min={0} max={100}
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
                    {savingProgress ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {goal.status === 'active' && goal.progress < 100 && !editingProgress && (
              <button onClick={markComplete} className="mt-4 text-xs text-muted hover:text-text transition-colors">
                Mark as complete →
              </button>
            )}
          </div>
        )}

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

        {/* Chat messages */}
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
              placeholder={`Update on "${goal.title}"…`}
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
