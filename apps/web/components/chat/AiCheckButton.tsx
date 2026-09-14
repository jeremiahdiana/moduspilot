'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { validateCheckText } from '@/lib/ai-check';

interface Result {
  ai: number; human: number;
}

// A ZeroGPT AI-text check on a single chat message. Calls /api/ai-check (ZeroGPT
// proxy). Detection is probabilistic, so we present the likelihood as AI% and
// human%, never a hard verdict.
export default function AiCheckButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error' | 'hidden'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setState('idle');
    setResult(null);
    setError('');
    return () => { pending.current?.abort(); pending.current = null; };
  }, [text]);

  const run = async () => {
    if (pending.current) return;
    const checked = validateCheckText(text);
    if ('error' in checked) { setError(checked.message); setState('error'); return; }
    const controller = new AbortController();
    pending.current = controller;
    setState('loading');
    setError('');
    const timer = setTimeout(() => {
      controller.abort();
      if (pending.current === controller) {
        pending.current = null;
        setError('The checker took too long. Please retry.');
        setState('error');
      }
    }, 12_000);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (controller.signal.aborted) return;
      if (!token) throw new Error('Please sign in to check text.');
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: checked.text }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (pending.current !== controller) return;
      if (!res.ok) throw new Error(data?.message || 'Could not check this text right now.');
      if (!Number.isFinite(data.ai) || !Number.isFinite(data.human) || data.ai < 0 || data.ai > 1 || data.human < 0 || data.human > 1) {
        throw new Error('The checker returned no valid result.');
      }
      setResult(data as Result);
      setState('done');
    } catch (error) {
      if (pending.current !== controller) return;
      setError(error instanceof Error && !controller.signal.aborted ? error.message : 'The checker took too long. Please retry.');
      setState('error');
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) pending.current = null;
    }
  };

  const aiPct = result ? Math.round(result.ai * 100) : 0;
  const humanPct = result ? Math.round(result.human * 100) : 0;

  if (state === 'hidden') return null;

  return (
    <div className="pt-0.5">
      {state === 'idle' && (
        <button
          type="button"
          onClick={run}
          className="text-[11px] text-muted/70 hover:text-brand transition-colors flex items-center gap-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
          </svg>
          Check for AI
        </button>
      )}

      {state === 'loading' && (
        <span className="text-[11px] text-muted/70 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          Checking…
        </span>
      )}

      {state === 'error' && (
        <span className="text-[11px] text-muted/80">
          {error} <button type="button" onClick={run} className="text-brand hover:underline">Retry</button>
        </span>
      )}

      <AnimatePresence>
        {state === 'done' && result && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] rounded-lg border border-border bg-panel px-2.5 py-1.5"
          >
            <span className="font-medium text-text">{aiPct}% likely AI</span>
            <span className="text-muted/40">·</span>
            <span className="text-muted">{humanPct}% human</span>
            <span className="w-full text-[10px] text-muted/60 leading-snug">
              Detectors are probabilistic and can be wrong, so treat this as a signal, not proof.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
