'use client';

import { motion } from 'framer-motion';
import ScenariosPlayer from './ScenariosPlayer';

/* ── Left: a real generated chart ───────────────────────────────────────── */

const MONTHS = [
  { m: 'Jan', v: 38 },
  { m: 'Feb', v: 52 },
  { m: 'Mar', v: 44 },
  { m: 'Apr', v: 67 },
  { m: 'May', v: 78 },
  { m: 'Jun', v: 96 },
];

function ChartVisual() {
  return (
    <div className="absolute inset-0 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="text-[11px] text-muted">Revenue · last 6 months</p>
          <p className="text-2xl text-text mt-0.5" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>$48.2k</p>
        </div>
        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5 shrink-0 mt-1">
          +24%
        </span>
      </div>

      {/* plot */}
      <div className="relative flex-1 mt-4 min-h-0">
        {/* gridlines */}
        {[0, 25, 50, 75, 100].map(p => (
          <div key={p} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${p}%` }} />
        ))}
        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-2 px-0.5">
          {MONTHS.map((d, i) => (
            <div key={d.m} className="flex-1 flex flex-col justify-end h-full">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${d.v}%` }}
                viewport={{ once: false, margin: '-40px' }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="w-full rounded-t-md bg-gradient-to-t from-brand/35 to-brand"
              />
            </div>
          ))}
        </div>
      </div>

      {/* x axis */}
      <div className="flex gap-2 mt-2 px-0.5">
        {MONTHS.map(d => (
          <span key={d.m} className="flex-1 text-center text-[10px] text-muted">{d.m}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Right: theme-aware code editor ─────────────────────────────────────── */

type Tok = [string, 'kw' | 'fn' | 'str' | 'prop' | 'punc'];
const CODE: Tok[][] = [
  [['const ', 'kw'], ['data', 'fn'], [' = ', 'punc'], ['await ', 'kw'], ['modus', 'fn'], ['.ask({', 'punc']],
  [['  model', 'prop'], [': ', 'punc'], ["'auto'", 'str'], [',', 'punc']],
  [['  prompt', 'prop'], [': ', 'punc'], ["'summarize Q3'", 'str'], [',', 'punc']],
  [['});', 'punc']],
  [['', 'punc']],
  [['send', 'fn'], ['(data.', 'punc'], ['summary', 'prop'], [')', 'punc']],
];

function CodeVisual() {
  return (
    <div className="absolute inset-0 p-5">
      <div
        className="h-full rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ background: 'var(--code-chrome)', borderBottom: '1px solid var(--code-border)' }}
        >
          {['#ff5f56', '#ffbd2e', '#27c93f'].map(c => (
            <span key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
          ))}
          <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--code-punc)' }}>agent.ts</span>
        </div>
        <div className="p-3 font-mono text-[11px] leading-relaxed flex-1 overflow-hidden">
          {CODE.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, margin: '-40px' }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.16 }}
              className="whitespace-pre"
            >
              {line.map(([txt, role], j) => (
                <span key={j} style={{ color: `var(--code-${role})` }}>{txt}</span>
              ))}
              {i === CODE.length - 1 && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-[6px] h-[12px] ml-0.5 align-middle"
                  style={{ background: 'var(--code-cursor)' }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Section ────────────────────────────────────────────────────────────── */

export default function WhyModusSection() {
  return (
    <section className="py-24 sm:py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl text-text tracking-tight mb-4">Beyond the answer</h2>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto">
            Every model is table stakes. MODUS makes things, handles your day, and ships the work.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left: chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="lg:col-span-1"
          >
            <div className="relative h-[430px] rounded-2xl border border-border bg-panel overflow-hidden">
              <ChartVisual />
            </div>
            <p className="mt-5 text-[15px] leading-relaxed">
              <span className="text-text font-semibold">Makes things.</span>{' '}
              <span className="text-muted">Charts, images and editable PDFs, generated right in the chat.</span>
            </p>
          </motion.div>

          {/* Middle: live scenarios */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
            className="lg:col-span-2"
          >
            {/* Narrower than its column so the player doesn't dwarf the two
                cards flanking it; centred, with the caption matching its width. */}
            <div className="max-w-[470px] mx-auto">
              <ScenariosPlayer />
              <p className="mt-5 text-[15px] leading-relaxed">
                <span className="text-text font-semibold">Handles your day.</span>{' '}
                <span className="text-muted">Real situations, one message each. It drafts, schedules and acts, always waiting on your approval.</span>
              </p>
            </div>
          </motion.div>

          {/* Right: code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
            className="lg:col-span-1"
          >
            <div className="relative h-[430px] rounded-2xl border border-border bg-panel overflow-hidden">
              <CodeVisual />
            </div>
            <p className="mt-5 text-[15px] leading-relaxed">
              <span className="text-text font-semibold">Ships the work.</span>{' '}
              <span className="text-muted">Writes and reviews code, triages your inbox, executes across your tools.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
