'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '12+', label: 'apps the average person uses to manage their life' },
  { value: '0', label: 'of them talk to each other' },
  { value: '100%', label: 'of the glue work falls on you' },
];

export default function QuoteSection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-panel" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(124,58,237,0.30),transparent)] dark:bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-6">The Problem</p>
          <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold text-text leading-tight mb-12">
            You're using Gmail, Notion, Todoist, Google Calendar, ChatGPT, and six other apps —
            and <span className="text-brand">you're still the one holding it all together.</span>
          </blockquote>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            {STATS.map(s => (
              <motion.div
                key={s.value}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <p className="text-4xl font-black text-brand mb-2">{s.value}</p>
                <p className="text-xs text-muted leading-relaxed">{s.label}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-muted text-base mt-12 max-w-xl mx-auto">
            MODUS is the intelligence layer that connects everything — and runs the parts that don't need you.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
