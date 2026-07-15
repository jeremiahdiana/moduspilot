'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { modelName } from '@/lib/models';
import { logoForModel } from '@/components/marketing/ModelLogos';
import MarkdownMessage from '@/components/chat/MarkdownMessage';

// Compare mode: one prompt, three models, side by side, streaming in parallel.
// Each column owns its own fetch, so a slow model never blocks the others and
// one failing column never takes the card down with it.
//
// Mobile has no room for three columns, so the same data renders as a swipeable
// single column with a tab strip. Same state, different shell.

type ColumnState = {
  modelId: string;
  text: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
  ms?: number;
};

function StatusDot({ status }: { status: ColumnState['status'] }) {
  if (status === 'streaming') {
    return (
      <span className="flex items-center gap-0.5" aria-label="Streaming">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-brand"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
          />
        ))}
      </span>
    );
  }
  if (status === 'error') return <span className="text-red-400 text-[10px]">failed</span>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5 text-emerald-400" aria-label="Done">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ColumnHeader({ col }: { col: ColumnState }) {
  const Logo = logoForModel(col.modelId);
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
      <span className="flex items-center gap-1.5 min-w-0">
        <Logo className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-semibold text-text truncate">{modelName(col.modelId)}</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {col.ms !== undefined && col.status === 'done' && (
          <span className="text-[10px] text-muted tabular-nums">{(col.ms / 1000).toFixed(1)}s</span>
        )}
        <StatusDot status={col.status} />
      </span>
    </div>
  );
}

function ColumnBody({ col, onUse }: { col: ColumnState; onUse?: (text: string) => void }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2.5 min-h-[140px] max-h-[420px]">
        {col.status === 'error' ? (
          <p className="text-xs text-red-400">{col.error ?? 'This model failed to answer.'}</p>
        ) : col.text ? (
          <div className="text-sm">
            <MarkdownMessage>{col.text}</MarkdownMessage>
          </div>
        ) : (
          <div className="space-y-2 pt-1" aria-hidden>
            {[100, 82, 91].map((w, i) => (
              <motion.div
                key={i}
                className="h-2 rounded bg-text/[0.07]"
                style={{ width: `${w}%` }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </div>
        )}
      </div>
      {onUse && col.status === 'done' && col.text && (
        <div className="px-3 pb-2.5 pt-1">
          <button
            onClick={() => onUse(col.text)}
            className="w-full text-[11px] font-medium text-muted hover:text-brand border border-border hover:border-brand/40 rounded-md py-1 transition-colors"
          >
            Continue with this
          </button>
        </div>
      )}
    </div>
  );
}

export default function CompareCard({
  prompt, models, onClose, onUse,
}: {
  prompt: string;
  models: string[];
  onClose: () => void;
  /** Feeds a chosen answer back into the normal conversation. */
  onUse?: (text: string) => void;
}) {
  const [columns, setColumns] = useState<ColumnState[]>(
    () => models.map(m => ({ modelId: m, text: '', status: 'streaming' as const })),
  );
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController[]>([]);

  const runColumn = useCallback(async (modelId: string, index: number, token: string) => {
    const ctrl = new AbortController();
    abortRef.current.push(ctrl);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/chat/compare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: modelId }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({})) as { error?: string };
        setColumns(c => c.map((col, i) => i === index
          ? { ...col, status: 'error', error: msg.error ?? `Request failed (${res.status})` } : col));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        // Snapshot into the closure-free updater so columns never clobber each other.
        setColumns(c => c.map((col, i) => (i === index ? { ...col, text: acc } : col)));
      }
      setColumns(c => c.map((col, i) => (i === index
        ? { ...col, status: 'done', ms: Math.round(performance.now() - t0) } : col)));
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setColumns(c => c.map((col, i) => (i === index
        ? { ...col, status: 'error', error: 'Could not reach this model.' } : col)));
    }
  }, [prompt]);

  // Fire all three at once. Runs exactly once — React 18 StrictMode double-mounts
  // in dev, and without this guard every comparison would be billed twice.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token || cancelled) {
        setColumns(c => c.map(col => ({ ...col, status: 'error', error: 'Not signed in.' })));
        return;
      }
      await Promise.all(models.map((m, i) => runColumn(m, i, token)));
    })();
    const controllers = abortRef.current;
    return () => { cancelled = true; controllers.forEach(c => c.abort()); };
  }, [models, runColumn]);

  // Verdict once every column has settled and at least two actually answered.
  const allSettled = columns.every(c => c.status !== 'streaming');
  const answered = columns.filter(c => c.status === 'done' && c.text.trim());
  useEffect(() => {
    if (!allSettled || verdict || verdictLoading || answered.length < 2) return;
    setVerdictLoading(true);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch('/api/chat/compare/verdict', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            answers: answered.map(c => ({ model: c.modelId, text: c.text, ms: c.ms })),
          }),
        });
        const data = await res.json().catch(() => ({})) as { verdict?: string | null };
        if (data.verdict) setVerdict(data.verdict);
      } finally {
        setVerdictLoading(false);
      }
    })();
  }, [allSettled, answered, prompt, verdict, verdictLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="w-full rounded-xl border border-border bg-bg overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-panel/40">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5 text-brand">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M16 3v18M3 8h18M3 16h18" />
          </svg>
          <span className="font-semibold text-text">Compare</span>
          <span className="text-muted/70">· {columns.length} models</span>
        </span>
        <button onClick={onClose} aria-label="Close comparison" className="p-1 rounded text-muted hover:text-text transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Desktop: three real columns, so the race is visible. */}
      <div className="hidden sm:grid sm:grid-cols-3 divide-x divide-border/60">
        {columns.map(col => (
          <div key={col.modelId} className="flex flex-col min-w-0">
            <ColumnHeader col={col} />
            <ColumnBody col={col} onUse={onUse} />
          </div>
        ))}
      </div>

      {/* Mobile: one column + a tab strip. Three columns at 390px is unreadable. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-0.5 p-1 border-b border-border/60">
          {columns.map((col, i) => {
            const Logo = logoForModel(col.modelId);
            return (
              <button
                key={col.modelId}
                onClick={() => setTab(i)}
                className={`relative flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  tab === i ? 'text-brand' : 'text-muted'
                }`}
              >
                {tab === i && (
                  <motion.span layoutId="compareTab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 bg-brand/15 rounded-md" />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Logo className="w-3 h-3" />
                  <StatusDot status={col.status} />
                </span>
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col"
          >
            <ColumnHeader col={columns[tab]} />
            <ColumnBody col={columns[tab]} onUse={onUse} />
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(verdict || verdictLoading) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-border/60 bg-panel/40 overflow-hidden"
          >
            <div className="flex items-start gap-2 px-3 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
              </svg>
              {verdict ? (
                <p className="text-xs text-muted leading-relaxed">
                  <span className="text-text font-medium">MODUS:</span> {verdict}
                </p>
              ) : (
                <p className="text-xs text-muted/70">Comparing answers…</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
