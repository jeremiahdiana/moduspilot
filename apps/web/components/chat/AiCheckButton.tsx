'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { auth } from '@/lib/firebase';

interface Result {
  ai: number; human: number; mixed: number;
  predictedClass: string; confidence: string;
}

// A ZeroGPT-style AI-text check on a single chat message. Calls /api/ai-check
// (GPTZero proxy). Detection is probabilistic, so we present the likelihood and
// confidence band, never a hard verdict.
export default function AiCheckButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setState('loading');
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || 'Could not check this text right now.');
        setState('error');
        return;
      }
      setResult(data as Result);
      setState('done');
    } catch {
      setError('Could not reach the checker.');
      setState('error');
    }
  };

  const aiPct = result ? Math.round(result.ai * 100) : 0;
  const humanPct = result ? Math.round(result.human * 100) : 0;

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
            <span className="text-muted/40">·</span>
            <span className="text-muted capitalize">{result.confidence} confidence</span>
            <span className="w-full text-[10px] text-muted/60 leading-snug">
              Detectors are probabilistic and can be wrong — treat this as a signal, not proof.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
