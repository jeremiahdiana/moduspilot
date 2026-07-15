'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { OpenAILogo, ClaudeLogo, GeminiLogo, GrokLogo } from '@/components/marketing/ModelLogos';

/**
 * The stack you cancel.
 *
 * ⚠️ EVERY PRICE HERE IS REAL AND VERIFIED (July 2026) AND EVERY ROW IS SOMETHING
 * MODUS ACTUALLY DOES TODAY. That is the whole design. The claim it replaces was
 * "ChatGPT Plus, Claude Pro and Gemini Advanced are $20-$30 each, so running all
 * three costs $200+/mo" — which contradicts itself in one sentence (3 x $20 is
 * $60) and sat next to a live Stripe button. The $200 figure was ChatGPT PRO, a
 * single tier, not three subscriptions.
 *
 * Itemising is what makes it persuasive: a reader can check any line, so the
 * total is believable in a way a round "$200+" never is. It also lands at $140,
 * which is most of the drama with none of the lying.
 *
 * RULES for editing this list:
 *  - Never add a row MODUS cannot do TODAY. Cal AI-style food logging and Gamma
 *    decks are the modes plan, i.e. unbuilt. A promise here is a refund later.
 *  - Never round a price up. Re-verify before changing one.
 */
type Row = {
  name: string;
  price: number;
  /** Rendered mark, or null for a plain dot when we have no logo. */
  logo?: React.ComponentType<{ className?: string }>;
  /** What MODUS does instead. Must be shipped, not planned. */
  instead: string;
};

const STACK: Row[] = [
  { name: 'ChatGPT Plus',        price: 20, logo: OpenAILogo, instead: 'GPT-4o, built in' },
  { name: 'Claude Pro',          price: 20, logo: ClaudeLogo, instead: 'Claude Sonnet, built in' },
  { name: 'Google AI Pro',       price: 20, logo: GeminiLogo, instead: 'Gemini, built in' },
  { name: 'SuperGrok',           price: 30, logo: GrokLogo,   instead: 'Grok, built in' },
  { name: 'Perplexity Pro',      price: 20,                   instead: 'Web search on any model' },
  { name: 'Midjourney Standard', price: 30,                   instead: 'Image generation in chat' },
];

const TOTAL = STACK.reduce((n, r) => n + r.price, 0);
const MODUS = 24;

function Dot() {
  return <span className="w-4 h-4 rounded-full bg-text/[0.12] shrink-0" aria-hidden />;
}

export default function StackSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });

  return (
    <section className="px-6 py-20 max-w-5xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-3">The math</p>
        <h2 className="text-4xl md:text-5xl font-semibold text-text mb-4 tracking-tight">
          You&apos;re paying for six of these.<br />
          <span className="text-brand dark:text-brand-light">MODUS is one of them.</span>
        </h2>
        <p className="text-muted text-lg leading-relaxed max-w-2xl mb-10">
          Every line below is a real price, and every line is something MODUS already does. Check them yourself.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-center">
        {/* The stack */}
        <div className="bg-panel rounded-2xl p-2 shadow-lg shadow-black/20">
          {STACK.map((row, i) => {
            const Logo = row.logo;
            return (
              <motion.div
                key={row.name}
                initial={{ opacity: 0, x: -12 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.08 * i, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              >
                {Logo ? <Logo className="w-4 h-4 shrink-0" /> : <Dot />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-muted line-through decoration-red-400/50 truncate">
                    {row.name}
                  </span>
                  <span className="block text-[11px] text-muted/70 truncate">{row.instead}</span>
                </span>
                <span className="text-sm font-semibold text-muted tabular-nums shrink-0">${row.price}</span>
              </motion.div>
            );
          })}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.08 * STACK.length + 0.1 }}
            className="flex items-center justify-between px-3 py-3 mt-1 border-t border-text/[0.08]"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Every month</span>
            <span className="text-2xl font-semibold text-text tabular-nums">${TOTAL}</span>
          </motion.div>
        </div>

        {/* Arrow — rotates flat on small screens where the columns stack */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 22 }}
          className="flex justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7 text-brand rotate-90 lg:rotate-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </motion.div>

        {/* MODUS */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="bg-panel rounded-2xl p-6 ring-1 ring-brand/25 shadow-[0_0_60px_rgba(124,58,237,0.10)]"
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-semibold text-brand dark:text-brand-light tabular-nums">${MODUS}</span>
            <span className="text-sm text-muted">/mo</span>
          </div>
          <p className="text-sm font-semibold text-text mb-4">MODUS. All of it, one bill.</p>
          <ul className="space-y-2 mb-6">
            {[
              'Every model above, in one chat',
              'Routes each task to the best one',
              'Remembers you across all of them',
              'Reads your email and calendar',
              'Acts, with your approval',
            ].map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3 text-brand shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="btn-primary block text-center px-5 py-3 text-white font-bold rounded-xl text-sm"
          >
            Start your 3-day free trial
          </Link>
          <p className="text-[11px] text-muted/60 text-center mt-2.5">
            Save ${TOTAL - MODUS}/mo · Cancel anytime
          </p>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.7 }}
        className="text-xs text-muted/60 mt-6 max-w-2xl"
      >
        Prices as listed by each provider, July 2026. Your everyday tools stay — Gmail, Calendar, Notion, Slack. MODUS runs on top of them.
      </motion.p>
    </section>
  );
}
