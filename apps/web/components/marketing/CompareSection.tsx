'use client';

import { motion } from 'framer-motion';

const ROWS = [
  { feature: 'Every frontier model, auto-routed per task', modus: true,  chatgpt: 'One model', notion: false },
  { feature: 'Daily briefing with priorities', modus: true,  chatgpt: false, notion: false },
  { feature: 'Approve every AI action before it runs', modus: true,  chatgpt: false, notion: false },
  { feature: 'Goal → milestone → habit → task engine', modus: true,  chatgpt: false, notion: 'Manual' },
  { feature: 'Gmail triage & draft replies', modus: true,  chatgpt: false, notion: false },
  { feature: 'Memory across all conversations', modus: true,  chatgpt: 'Paid', notion: false },
  { feature: 'Bring your own Claude or GPT key', modus: true,  chatgpt: 'N/A', notion: false },
  { feature: 'Pattern recognition & proactive alerts', modus: true,  chatgpt: false, notion: false },
  { feature: 'Habit streaks + streak-at-risk alerts', modus: true,  chatgpt: false, notion: false },
  { feature: 'Google Calendar read + write', modus: true,  chatgpt: false, notion: false },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-brand font-bold text-base">✓</span>;
  if (value === false) return <span className="text-muted/30 text-base">—</span>;
  return <span className="text-muted text-xs font-medium">{value}</span>;
}

export default function CompareSection() {
  return (
    <section className="py-32 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">
            Why pay for one AI<br className="hidden sm:block" /> when you can have them all?
          </h2>
          <p className="text-muted text-lg max-w-xl mx-auto">
            One subscription. Every frontier model, plus an assistant that actually runs your day — not another chatbot that only answers.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className="bg-panel border border-border rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="grid grid-cols-5 border-b border-border">
            <div className="col-span-2 px-6 py-4" />
            {['MODUS', 'ChatGPT', 'Notion'].map((col, i) => (
              <div key={col} className={`px-4 py-4 text-center ${i === 0 ? 'bg-brand/5 border-l border-r border-brand/20' : ''}`}>
                <span className={`text-xs font-bold uppercase tracking-widest ${i === 0 ? 'text-brand' : 'text-muted'}`}>{col}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-5 border-b border-border/50 last:border-b-0 ${i % 2 === 0 ? '' : 'bg-bg/30'}`}
            >
              <div className="col-span-2 px-6 py-4 text-sm text-muted">{row.feature}</div>
              <div className="px-4 py-4 text-center bg-brand/5 border-l border-r border-brand/20">
                <Cell value={row.modus} />
              </div>
              <div className="px-4 py-4 text-center"><Cell value={row.chatgpt} /></div>
              <div className="px-4 py-4 text-center"><Cell value={row.notion} /></div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
