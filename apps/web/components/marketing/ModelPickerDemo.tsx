'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { OpenAILogo, ClaudeLogo, GeminiLogo } from './ModelLogos';

// Animated model picker: an invisible cursor taps down the list — Auto,
// Multi-model, then Claude / ChatGPT / Gemini — each row popping subtly as it's
// selected, and the composer chip up top updating to match. Loops forever.

type Row = { label: string; sub: string; node: React.ReactNode; chip: string };

const AutoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
  </svg>
);
const MultiIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M16 3v18M3 8h18M3 16h18" />
  </svg>
);

const ROWS: Row[] = [
  { label: 'Auto', sub: 'Best model, auto-picked', node: AutoIcon, chip: 'Auto' },
  { label: 'Multi-model', sub: 'Ask several at once', node: MultiIcon, chip: 'Multi-model' },
  { label: 'Claude Sonnet 5', sub: 'Anthropic', node: <ClaudeLogo className="w-4 h-4" />, chip: 'Claude' },
  { label: 'GPT-5.6', sub: 'OpenAI', node: <OpenAILogo className="w-4 h-4" />, chip: 'ChatGPT' },
  { label: 'Gemini 3.5', sub: 'Google', node: <GeminiLogo className="w-4 h-4" />, chip: 'Gemini' },
];

const ROW_H = 54;

export default function ModelPickerDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-60px' });
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setSel(s => (s + 1) % ROWS.length), 1800);
    return () => clearTimeout(t);
  }, [inView, sel]);

  return (
    <div ref={ref} className="rounded-2xl bg-panel border border-border overflow-hidden shadow-[0_16px_40px_-20px_rgba(30,20,60,0.25)]">
      {/* Composer bar with the live model chip */}
      <div className="px-4 pt-4 pb-3 border-b border-text/[0.06]">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/60 px-3 py-2.5">
          <span className="text-[13px] text-muted flex-1 truncate">Ask MODUS anything…</span>
          <motion.span
            key={sel}
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 text-brand px-2 py-1 text-[11px] font-semibold"
          >
            {ROWS[sel].node}
            {ROWS[sel].chip}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
          </motion.span>
        </div>
      </div>

      {/* The picker list + tapping cursor */}
      <div className="relative px-2 py-2" style={{ height: ROWS.length * ROW_H + 8 }}>
        {ROWS.map((r, i) => {
          const selected = i === sel;
          return (
            <motion.div
              key={r.label}
              animate={{ scale: selected ? [1, 0.975, 1] : 1 }}
              transition={{ duration: 0.3 }}
              style={{ height: ROW_H }}
              className={`flex items-center gap-3 px-3 rounded-xl ${i === 2 ? 'mt-0' : ''} ${
                selected ? 'bg-brand/10' : ''
              }`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-brand/15' : 'bg-text/[0.05]'}`}>
                {r.node}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold truncate ${selected ? 'text-text' : 'text-text/80'}`}>{r.label}</span>
                <span className="block text-[11px] text-muted truncate">{r.sub}</span>
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: selected ? 1 : 0, scale: selected ? 1 : 0.6 }}
                transition={{ duration: 0.2 }}
                className="text-brand shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
