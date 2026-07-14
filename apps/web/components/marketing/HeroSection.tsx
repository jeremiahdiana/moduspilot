'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/* ── Typewriter ── */
const PHRASES = ['builds your plan', 'tracks your habits', 'triages your inbox', 'blocks your deep work', 'tells you what to focus on'];
function Typewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [erasing, setErasing] = useState(false);
  useEffect(() => {
    const phrase = PHRASES[idx];
    if (!erasing) {
      if (text.length < phrase.length) { const t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 52); return () => clearTimeout(t); }
      const t = setTimeout(() => setErasing(true), 2000); return () => clearTimeout(t);
    }
    if (text.length > 0) { const t = setTimeout(() => setText(text.slice(0, -1)), 28); return () => clearTimeout(t); }
    setErasing(false); setIdx(i => (i + 1) % PHRASES.length);
  }, [text, erasing, idx]);
  return (
    <span className="text-brand font-semibold whitespace-nowrap">
      {text}<span className="inline-block w-0.5 h-[0.85em] bg-brand ml-0.5 animate-pulse align-middle rounded-full" />
    </span>
  );
}


/* ── Scrolling live activity ticker ── */
const TICKER = [
  'Deep work blocked, 9 to 12 AM',
  '4 emails triaged, 2 drafts queued',
  'Running streak: 14 days',
  'Milestone reached: Ship landing page',
  '3 tasks approved by you',
  '3 PM moved to Friday, approved',
  'Pattern detected: energy dips after lunch',
  'Read 20 min, streak: 21 days',
  'Weekly review ready for your approval',
  'Reply sent to Marcus, approved',
];
function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden w-full max-w-3xl mx-auto mt-10">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="flex gap-3 whitespace-nowrap"
      >
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs text-muted bg-text/[0.05] rounded-full px-3.5 py-1.5">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Hero ── */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 pb-16">

      {/* Background: neutral depth and a faint static dot grid. No color wash. */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-bg" />
        {/* Soft overhead light, achromatic so the page reads black */}
        <div className="absolute top-0 left-0 right-0 h-[80%] bg-[radial-gradient(ellipse_120%_70%_at_50%_-5%,rgba(0,0,0,0.04),transparent_65%)] dark:bg-[radial-gradient(ellipse_120%_70%_at_50%_-5%,rgba(255,255,255,0.05),transparent_65%)]" />
        {/* Faint static dot grid for texture */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(15,15,20,0.07)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />
      </div>

      {/* Text block. w-full forces it to fill the flex container so text-center works correctly on mobile */}
      <div className="relative w-full max-w-3xl mx-auto text-center z-10 mb-12 pt-14">
        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold leading-[1.08] tracking-tight mb-6"
        >
          <span className="text-text/60">The AI That</span><br />
          <span className="text-text">Runs Your Life.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          className="text-base sm:text-lg text-muted max-w-xl mx-auto mb-5 leading-relaxed"
        >
          Tell MODUS your goals. It <Typewriter />, every morning.
          You approve every action. Nothing runs without you.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: 'easeOut' }}
          className="text-sm sm:text-base text-muted max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Write with <span className="text-text font-semibold">Gemini</span>. Research with <span className="text-text font-semibold">Claude</span>. Ask <span className="text-text font-semibold">ChatGPT</span>. Routed to the best one, automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.34, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <a
            href="/login"
            className="btn-primary group relative w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-brand text-white text-sm sm:text-base font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-100 text-center"
          >
            <span className="relative z-10">Start your 3-day free trial</span>
          </a>
          <a href="#features" className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
            See how it works
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>↓</motion.span>
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted"
        >
          {['Every frontier model', 'Gmail & Calendar', 'Web & Mac · iPhone beta', 'Cancel anytime'].map((t, i) => (
            <span key={t} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="hidden sm:block w-px h-3 bg-muted/25" />}
              {t}
            </span>
          ))}
        </motion.div>

        {/* Live ticker */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }}>
          <Ticker />
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent pointer-events-none z-20" />
    </section>
  );
}
