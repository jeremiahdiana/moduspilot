'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import type { UserSettings, Memory } from '@/hooks/useUserSettings';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-brand' : 'bg-border'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

interface Props {
  settings: UserSettings;
  memories: Memory[];
  saving: boolean;
  onSave: (updates: Partial<UserSettings>) => Promise<void>;
  onAdd: (content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function MemorySettings({ settings, memories, saving, onSave, onAdd, onDelete }: Props) {
  const [newMemory, setNewMemory] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  async function handleClearAll() {
    if (!confirm('Clear all memories? This removes everything MODUS has learned from your conversations. This cannot be undone.')) return;
    setClearing(true);
    setClearDone(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/memory/clear', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setClearDone(true);
      setTimeout(() => setClearDone(false), 3000);
    } catch {
      alert('Failed to clear memories. Try again.');
    } finally {
      setClearing(false);
    }
  }

  const handleAdd = async () => {
    if (!newMemory.trim()) return;
    setAdding(true);
    try {
      await onAdd(newMemory);
      setNewMemory('');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Memory</h2>
        <p className="text-sm text-muted">MODUS remembers facts about you that persist across all conversations.</p>
      </div>

      {/* How memory works */}
      <div className="bg-panel border border-border rounded-xl p-5 space-y-2">
        <p className="text-sm font-semibold text-text">How MODUS memory works</p>
        <p className="text-xs text-muted leading-relaxed">MODUS maintains two memory layers. <span className="text-text">Semantic context</span> — every conversation is stored as embeddings so MODUS can surface relevant past context when it's useful. <span className="text-text">Stored memories</span> — explicit facts you add manually or that MODUS extracts, visible below. Both are private to your account and never shared.</p>
      </div>

      {/* Settings */}
      <div className="bg-panel border border-border rounded-xl divide-y divide-border">
        <div className="flex items-start justify-between p-6 gap-6">
          <div className="flex-1">
            <p className="text-sm font-medium text-text mb-1">Generate Memory from Chat History</p>
            <p className="text-xs text-muted leading-relaxed">When enabled, MODUS automatically extracts and stores facts from your conversations — your preferences, recurring goals, decisions — so it builds a profile of you over time.</p>
          </div>
          <Toggle
            checked={settings.generateMemoryFromChat}
            onChange={v => onSave({ generateMemoryFromChat: v })}
            disabled={saving}
          />
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted">Import from Other AI</p>
            <span className="text-[10px] bg-border text-muted font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
          </div>
          <p className="text-xs text-muted">Bring your memory profile from ChatGPT, Gemini, or other AI tools into MODUS.</p>
        </div>
      </div>

      {/* Add memory */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Add Memory</h3>
        <p className="text-xs text-muted">Manually store a fact MODUS should always keep in mind.</p>
        <div className="flex gap-3">
          <input
            value={newMemory}
            onChange={e => setNewMemory(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
            placeholder="e.g. I prefer Markdown tables over bullet lists"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newMemory.trim()}
            className="px-4 py-2 bg-brand text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-brand/90 transition-colors"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Memory list */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Stored Memories</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{memories.length} total</span>
            {(memories.length > 0 || true) && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
              >
                {clearing ? 'Clearing…' : clearDone ? '✓ Cleared' : 'Clear all'}
              </button>
            )}
          </div>
        </div>
        {memories.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">No memories yet. Add one above or enable auto-generation.</p>
        ) : (
          <div className="space-y-2">
            {memories.map(m => (
              <div
                key={m.id}
                className="group flex items-start gap-3 py-3 px-4 rounded-lg bg-bg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text leading-relaxed">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium ${m.source === 'generated' ? 'text-brand' : 'text-muted'}`}>
                      {m.source === 'generated' ? 'Auto-generated' : 'Manual'}
                    </span>
                    <span className="text-[10px] text-muted">
                      {m.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all disabled:opacity-50"
                >
                  {deletingId === m.id ? '…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
