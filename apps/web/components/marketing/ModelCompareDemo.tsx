'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MODEL_LOGOS, OpenAILogo, ClaudeLogo, GeminiLogo } from './ModelLogos';

// Marketing twin of the in-app CompareCard: one prompt, three models, answering
// side by side. Simulated on purpose — this is a landing page, not a live
// endpoint — but the shape, timings, and verdict row mirror the real feature.

// Mirror MODEL_LOGOS' own logo signature rather than restating it — these come
// straight out of that list.
type Col = { name: string; logo: (typeof MODEL_LOGOS)[number]['logo']; answer: string; ms: number };

const PROMPT = 'Explain compound interest to a 10 year old.';

// Logos are imported directly rather than looked up by name: MODEL_LOGOS calls
// OpenAI's entry "GPT-4o", so a fuzzy match on "ChatGPT" silently fell back to
// the first entry and rendered Claude's mark on the ChatGPT column.
const COLS: Col[] = [
  { name: 'ChatGPT', logo: OpenAILogo, ms: 1400, answer: 'Imagine a snowball rolling downhill. It picks up more snow, so it gets bigger. The bigger it gets, the more snow it picks up.' },
  { name: 'Claude',  logo: ClaudeLogo, ms: 2100, answer: 'You have $10. Every year it grows 10%. Year one you earn $1. Year two you earn $1.10, because now you have $11 earning for you. Your money starts making money.' },
  { name: 'Gemini',  logo: GeminiLogo, ms: 900,  answer: 'Money that makes money, which then makes more money. Like a tree that grows seeds that grow more trees.' },
];

const VERDICT = 'Claude explained the mechanism, Gemini was fastest and stuck the metaphor, ChatGPT stayed simplest. MODUS picked Claude.';

function useTypeIn(text: string, active: boolean, speed: number) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return out;
}

function Column({ col, active, delayMs }: { col: Col; active: boolean; delayMs: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setStarted(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);

  const typed = useTypeIn(col.answer, started, 18);
  const done = typed.length >= col.answer.length;
  const Logo = col.logo;

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-text/[0.06]">
        <span className="flex items-center gap-1.5 min-w-0">
          <Logo className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold text-text truncate">{col.name}</span>
        </span>
        {done ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted tabular-nums">{(col.ms / 1000).toFixed(1)}s</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : (
          <span className="flex items-center gap-0.5 shrink-0">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="w-1 h-1 rounded-full bg-brand"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }} />
            ))}
          </span>
        )}
      </div>
      <div className="px-3 py-3 min-h-[132px]">
        <p className="text-[13px] text-muted leading-relaxed">
          {typed}
          {started && !done && <span className="inline-block w-0.5 h-3.5 bg-brand ml-0.5 align-middle animate-pulse" />}
        </p>
      </div>
    </div>
  );
}

export default function ModelCompareDemo() {
  const ref = useRef<HTMLDivElement>(null);
  // Sections animate in on scroll; starting the typing before the card is on
  // screen would mean it's already finished by the time anyone sees it.
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setShowVerdict(true), 3600);
    return () => clearTimeout(t);
  }, [inView]);

  return (
    <div ref={ref} className="rounded-2xl bg-panel overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-text/[0.06]">
        <span className="flex items-center gap-1.5 text-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5 text-brand">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M16 3v18M3 8h18M3 16h18" />
          </svg>
          <span className="font-semibold text-text">Compare</span>
          <span className="text-muted/70">· 3 models, one prompt</span>
        </span>
      </div>

      <div className="px-4 py-3 border-b border-text/[0.06]">
        <div className="flex justify-end">
          <div className="bg-brand rounded-xl rounded-tr-sm px-3.5 py-2 max-w-[85%]">
            <p className="text-[13px] text-white">{PROMPT}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-text/[0.06]">
        {COLS.map((c, i) => (
          <Column key={c.name} col={c} active={inView} delayMs={i * 180} />
        ))}
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: showVerdict ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start gap-2 px-4 py-3 border-t border-text/[0.06] bg-bg/40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
        </svg>
        <p className="text-[11px] text-muted leading-relaxed">
          <span className="text-text font-medium">MODUS:</span> {VERDICT}
        </p>
      </motion.div>
    </div>
  );
}
