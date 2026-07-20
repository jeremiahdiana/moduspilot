'use client';

import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MODEL_LOGOS, OpenAILogo, ClaudeLogo, GeminiLogo } from './ModelLogos';

// Marketing twin of the in-app CompareCard: one prompt, three models answering
// side by side, then a MODUS verdict. It now LOOPS through several prompts —
// each holds ~13s so it's readable — and a different model wins each time, which
// is the real pitch: the right model for the job, picked for you.

type Logo = (typeof MODEL_LOGOS)[number]['logo'];
type Col = { name: string; logo: Logo; answer: string; ms: number };
type Prompt = { q: string; cols: Col[]; verdict: string };

const PROMPTS: Prompt[] = [
  {
    q: 'Explain compound interest to a 10 year old.',
    cols: [
      { name: 'ChatGPT', logo: OpenAILogo, ms: 1400, answer: 'Imagine a snowball rolling downhill. It picks up more snow, so it gets bigger. The bigger it gets, the more it picks up.' },
      { name: 'Claude', logo: ClaudeLogo, ms: 2100, answer: 'You have $10. Every year it grows 10%. Year one you earn $1. Year two you earn $1.10, because now $11 is earning for you. Your money makes money.' },
      { name: 'Gemini', logo: GeminiLogo, ms: 900, answer: 'Money that makes money, which then makes more money. Like a tree that grows seeds that grow more trees.' },
    ],
    verdict: 'Claude explained the mechanism, Gemini was fastest, ChatGPT stayed simplest. MODUS picked Claude.',
  },
  {
    q: 'Write the first line of a cold email to a busy CEO.',
    cols: [
      { name: 'ChatGPT', logo: OpenAILogo, ms: 1200, answer: '"Hi Sarah, I’ll be quick: we help teams like yours cut reporting time in half."' },
      { name: 'Claude', logo: ClaudeLogo, ms: 1900, answer: '"Hi Sarah, you’re hiring five AEs this quarter. We ramp new reps 40% faster."' },
      { name: 'Gemini', logo: GeminiLogo, ms: 1000, answer: '"Hi Sarah, congrats on the raise. We help post-raise teams scale ops without new headcount."' },
    ],
    verdict: 'Gemini opened with a real trigger, Claude led with their problem, ChatGPT was cleanest. MODUS picked Gemini.',
  },
  {
    q: 'Dinner with chicken, rice and spinach?',
    cols: [
      { name: 'ChatGPT', logo: OpenAILogo, ms: 1100, answer: 'One-pan chicken and rice: sear the chicken, add rice and stock, stir spinach in at the end. 25 minutes.' },
      { name: 'Claude', logo: ClaudeLogo, ms: 2000, answer: 'Garlic-butter chicken rice bowl: crisp the chicken, cook rice in the pan juices, wilt the spinach, finish with lemon.' },
      { name: 'Gemini', logo: GeminiLogo, ms: 900, answer: 'Chicken and spinach fried rice: stir-fry the chicken, toss in cold rice, spinach and soy. Weeknight fast.' },
    ],
    verdict: 'Claude added the most flavor, Gemini was the fastest weeknight option, ChatGPT the simplest. MODUS picked ChatGPT.',
  },
];

function useTypeIn(text: string, active: boolean, speed: number) {
  const [out, setOut] = useState('');
  useEffect(() => {
    setOut('');
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

function Column({ col, delayMs }: { col: Col; delayMs: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const typed = useTypeIn(col.answer, started, 16);
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
      <div className="px-3 py-3 min-h-[150px] sm:min-h-[132px]">
        <p className="text-[13px] text-muted leading-relaxed">
          {typed}
          {started && !done && <span className="inline-block w-0.5 h-3.5 bg-brand ml-0.5 align-middle animate-pulse" />}
        </p>
      </div>
    </div>
  );
}

function Round({ prompt }: { prompt: Prompt }) {
  const [showVerdict, setShowVerdict] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowVerdict(true), 3600);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="px-4 py-3 border-b border-text/[0.06]">
        <div className="flex justify-end">
          <div className="bg-brand rounded-xl rounded-tr-sm px-3.5 py-2 max-w-[85%]">
            <p className="text-[13px] text-white">{prompt.q}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-text/[0.06]">
        {prompt.cols.map((c, i) => (
          <Column key={c.name} col={c} delayMs={i * 180} />
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
          <span className="text-text font-medium">MODUS:</span> {prompt.verdict}
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function ModelCompareDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-60px' });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // ~13s per prompt: types out (~2s), verdict at 3.6s, then reads until it
    // advances and crossfades to the next question, looping back to the first.
    const t = setTimeout(() => setIdx(i => (i + 1) % PROMPTS.length), 13000);
    return () => clearTimeout(t);
  }, [inView, idx]);

  return (
    <div ref={ref} className="rounded-2xl bg-panel border border-border overflow-hidden shadow-[0_16px_40px_-20px_rgba(30,20,60,0.25)]">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-text/[0.06]">
        <span className="flex items-center gap-1.5 text-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5 text-brand">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M16 3v18M3 8h18M3 16h18" />
          </svg>
          <span className="font-semibold text-text">Compare</span>
          <span className="text-muted/70">· 3 models, one prompt</span>
        </span>
        <span className="flex items-center gap-1">
          {PROMPTS.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-4 bg-brand' : 'w-1 bg-text/15'}`} />
          ))}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <Round key={idx} prompt={PROMPTS[idx]} />
      </AnimatePresence>
    </div>
  );
}
