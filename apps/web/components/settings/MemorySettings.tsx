'use client';

import { useState, useRef } from 'react';
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

type ImportTab = 'file' | 'paste';
type ImportState = 'idle' | 'preview' | 'importing' | 'done' | 'error';

function parseMemories(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: unknown) => {
          if (typeof item === 'string') return item.trim();
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            // ChatGPT format: { "memory": "..." }
            if (typeof obj.memory === 'string') return obj.memory.trim();
            // Generic: { "text": "..." } or { "content": "..." }
            if (typeof obj.text === 'string') return obj.text.trim();
            if (typeof obj.content === 'string') return obj.content.trim();
          }
          return '';
        })
        .filter(Boolean);
    }
  } catch {
    // Not JSON — fall through to plain text parsing
  }

  // Plain text: each non-empty line is a memory
  return trimmed
    .split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim()) // strip bullet chars
    .filter(line => line.length > 3);
}

export default function MemorySettings({ settings, memories, saving, onSave, onAdd, onDelete }: Props) {
  const [newMemory, setNewMemory] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('file');
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<string[]>([]);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target?.result as string;
      const parsed = parseMemories(raw);
      setPreview(parsed);
      setImportState(parsed.length > 0 ? 'preview' : 'error');
      setImportError(parsed.length === 0 ? 'No memories found in this file.' : '');
    };
    reader.readAsText(file);
  }

  function handlePastePreview() {
    const parsed = parseMemories(pasteText);
    setPreview(parsed);
    setImportState(parsed.length > 0 ? 'preview' : 'error');
    setImportError(parsed.length === 0 ? 'No memories found. Try pasting different content.' : '');
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setImportError('Not signed in.'); setImportState('error'); return; }
      const res = await fetch('/api/memory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memories: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setImportCount(data.imported);
      setImportState('done');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setImportState('error');
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setImportState('idle');
    setImporting(false);
    setPreview([]);
    setPasteText('');
    setImportError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleClearAll() {
    if (!confirm('Clear all memories? This removes everything MODUS has learned from your conversations. This cannot be undone.')) return;
    setClearing(true);
    setClearDone(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { alert('Not signed in.'); return; }
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
            <p className="text-sm font-medium text-text mb-1">Vector Memory</p>
            <p className="text-xs text-muted leading-relaxed">Store semantic memories from your conversations (in Pinecone) so MODUS recalls relevant past context across sessions. Turning this off disables long-term recall.</p>
          </div>
          <Toggle
            checked={settings.capabilities.vectorMemory}
            onChange={v => onSave({ capabilities: { ...settings.capabilities, vectorMemory: v } })}
            disabled={saving}
          />
        </div>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Import from Other AI</p>
              <p className="text-xs text-muted mt-0.5">Bring your memory profile from ChatGPT, Gemini, or other AI tools.</p>
            </div>
            <button
              onClick={() => { setImportOpen(o => !o); resetImport(); }}
              className="text-xs font-medium text-brand hover:underline shrink-0"
            >
              {importOpen ? 'Close' : 'Import'}
            </button>
          </div>

          {importOpen && (
            <div className="mt-4 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 bg-bg border border-border rounded-lg p-1 w-fit">
                {(['file', 'paste'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setImportTab(tab); resetImport(); }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      importTab === tab ? 'bg-brand text-white' : 'text-muted hover:text-text'
                    }`}
                  >
                    {tab === 'file' ? 'Upload file' : 'Paste text'}
                  </button>
                ))}
              </div>

              {/* How to export hint */}
              <div className="bg-bg border border-border rounded-lg px-4 py-3 text-xs text-muted space-y-1">
                <p className="font-medium text-text">How to export from ChatGPT:</p>
                <p>Settings → Data controls → Export data → download ZIP → open <span className="font-mono text-text/80">memories.json</span></p>
                <p className="mt-1 font-medium text-text">Other sources:</p>
                <p>Paste any plain text — each line becomes a memory.</p>
              </div>

              {importState === 'done' ? (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400 shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">{importCount} memories imported</p>
                    <p className="text-xs text-muted mt-0.5">They appear below and are now searchable by MODUS.</p>
                  </div>
                  <button onClick={resetImport} className="ml-auto text-xs text-muted hover:text-text">Import more</button>
                </div>
              ) : (
                <>
                  {importTab === 'file' ? (
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".json,.txt"
                        onChange={handleFileChange}
                        className="hidden"
                        id="memory-import-file"
                      />
                      <label
                        htmlFor="memory-import-file"
                        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-brand/50 rounded-xl py-8 cursor-pointer transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-muted">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-xs text-muted">Click to upload <span className="text-text font-medium">memories.json</span> or any <span className="text-text font-medium">.txt</span> file</span>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={pasteText}
                        onChange={e => { setPasteText(e.target.value); setImportState('idle'); setPreview([]); }}
                        placeholder="Paste your memories here — one per line, or paste ChatGPT JSON directly..."
                        rows={6}
                        className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors resize-none font-mono text-xs"
                      />
                      {importState === 'idle' && pasteText.trim() && (
                        <button
                          onClick={handlePastePreview}
                          className="w-full py-2 border border-border rounded-lg text-xs text-muted hover:text-text hover:border-brand/40 transition-colors"
                        >
                          Preview memories
                        </button>
                      )}
                    </div>
                  )}

                  {importState === 'error' && (
                    <p className="text-xs text-red-400">{importError}</p>
                  )}

                  {importState === 'preview' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted font-medium">{preview.length} memories found — first 5 shown:</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {preview.slice(0, 5).map((m, i) => (
                          <div key={i} className="text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 truncate">{m}</div>
                        ))}
                        {preview.length > 5 && (
                          <p className="text-[11px] text-muted text-center py-1">+{preview.length - 5} more</p>
                        )}
                      </div>
                      <button
                        onClick={handleImport}
                        disabled={importing}
                        className="w-full py-2.5 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {importing ? (
                          <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing…</>
                        ) : `Import ${preview.length} memories`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
            {memories.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
              >
                {clearing ? 'Clearing…' : clearDone ? (
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                    Cleared
                  </span>
                ) : 'Clear all'}
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
