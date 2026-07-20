'use client';

import { motion } from 'framer-motion';

/* ── Mockup visuals ─────────────────────────────────────────────────────── */

function CreateVisual() {
  const bars = [42, 68, 54, 88, 72];
  return (
    <div className="absolute inset-0 p-5 flex flex-col gap-3">
      {/* mini chart */}
      <div className="rounded-xl border border-border bg-bg/70 p-3.5 flex-1">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold text-muted">Revenue · Q3</span>
          <span className="text-[10px] text-emerald-400 font-semibold">+24%</span>
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: false, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
              className="flex-1 rounded-t bg-gradient-to-t from-brand/40 to-brand"
            />
          ))}
        </div>
      </div>
      {/* image + pdf chips */}
      <div className="flex gap-3">
        <div className="h-14 flex-1 rounded-xl bg-gradient-to-br from-brand via-fuchsia-500 to-blue-500 relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-white/20"
            animate={{ x: ['-120%', '160%'] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            style={{ width: '40%', filter: 'blur(6px)' }}
          />
        </div>
        <div className="h-14 flex-1 rounded-xl border border-border bg-bg/70 flex items-center gap-2 px-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5 text-brand">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
          </svg>
          <span className="text-[11px] font-semibold text-text truncate">report.pdf</span>
        </div>
      </div>
    </div>
  );
}

function DayVisual() {
  return (
    <div className="absolute inset-0 p-5 flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-bg/70 p-3.5">
        <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2">Morning briefing</p>
        {['Ship the launch email', 'Launch call · 2:00 PM', 'Review the weekly recap'].map((t, i) => (
          <div key={t} className="flex items-center gap-2 py-1">
            <span className="w-4 h-4 rounded-full bg-brand/15 text-brand text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="text-[11px] text-text truncate">{t}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-bg/70 p-3.5">
        <p className="text-[11px] text-text mb-2.5">Reply to Marcus: <span className="text-muted">&ldquo;Thursday works, sending an invite.&rdquo;</span></p>
        <div className="flex gap-2">
          <motion.span
            animate={{ boxShadow: ['0 0 0 0 rgba(124,58,237,0.5)', '0 0 0 6px rgba(124,58,237,0)'] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="rounded-lg bg-brand text-white text-[11px] font-semibold px-3 py-1.5"
          >
            Approve
          </motion.span>
          <span className="rounded-lg border border-border text-muted text-[11px] font-semibold px-3 py-1.5">Edit</span>
        </div>
      </div>
    </div>
  );
}

const CODE = [
  [['const ', '#c792ea'], ['data', '#82aaff'], [' = ', '#89ddff'], ['await ', '#c792ea'], ['modus', '#82aaff'], ['.ask({', '#89ddff']],
  [['  model', '#f78c6c'], [': ', '#89ddff'], ["'auto'", '#c3e88d'], [',', '#89ddff']],
  [['  prompt', '#f78c6c'], [': ', '#89ddff'], ["'summarize Q3'", '#c3e88d'], [',', '#89ddff']],
  [['});', '#89ddff']],
  [['send', '#82aaff'], ['(data.', '#89ddff'], ['summary', '#f78c6c'], [')', '#89ddff']],
];

function CodeVisual() {
  return (
    <div className="absolute inset-0 p-5">
      <div className="h-full rounded-xl bg-[#0d1117] border border-white/10 overflow-hidden flex flex-col">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#ff5f56]" />
          <span className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
          <span className="w-2 h-2 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-[10px] text-white/40 font-mono">agent.ts</span>
        </div>
        <div className="p-3 font-mono text-[11px] leading-relaxed flex-1">
          {CODE.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, margin: '-40px' }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.18 }}
              className="whitespace-pre"
            >
              {line.map(([txt, color], j) => (
                <span key={j} style={{ color: color as string }}>{txt}</span>
              ))}
              {i === CODE.length - 1 && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-[6px] h-[12px] bg-white/70 ml-0.5 align-middle"
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

const CARDS = [
  { visual: <CreateVisual />, lead: 'Creates anything.', body: 'Images, charts and editable PDFs, generated right in the chat and ready to ship.' },
  { visual: <DayVisual />, lead: 'Runs your day.', body: 'A morning briefing, drafted replies and scheduled time, each waiting on your approval.' },
  { visual: <CodeVisual />, lead: 'Gets work done.', body: 'Writes and reviews code, triages your inbox, and executes across your connected tools.' },
];

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
            Every model is table stakes. MODUS creates, plans and executes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.lead}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
            >
              <div className="relative h-64 rounded-2xl border border-border bg-panel overflow-hidden">
                {c.visual}
              </div>
              <p className="mt-5 text-[15px] leading-relaxed">
                <span className="text-text font-semibold">{c.lead}</span>{' '}
                <span className="text-muted">{c.body}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
