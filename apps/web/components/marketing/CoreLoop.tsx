'use client';

import { motion } from 'framer-motion';

const STEPS = [
  {
    label: 'Monitor',
    icon: '◉',
    desc: 'MODUS reads your calendar, email, goals, and habits in real time.',
  },
  {
    label: 'Decide',
    icon: '◈',
    desc: 'It makes executive decisions in the background — drafts, rescheduled meetings, flagged priorities.',
  },
  {
    label: 'Approve',
    icon: '◆',
    desc: 'Everything surfaces as an approval card. You see exactly what it plans to do.',
  },
  {
    label: 'Execute',
    icon: '◎',
    desc: 'You click approve. It fires. Nothing runs without your checkpoint.',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.2 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export default function CoreLoop() {
  return (
    <section id="how-it-works" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">
            Monitor. Decide. Approve. Execute.
          </h2>
          <p className="text-muted text-lg">Four steps. Zero micromanagement.</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 relative"
        >
          {STEPS.map((step, i) => (
            <motion.div key={step.label} variants={item} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(100%_-_12px)] w-6 h-px bg-gradient-to-r from-brand/40 to-border z-10" />
              )}

              <div className="bg-panel border border-border rounded-2xl p-6 h-full hover:border-brand/40 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-2xl mb-4 group-hover:bg-brand/20 transition-colors">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-brand uppercase tracking-widest mb-2">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-lg font-bold text-text mb-2">{step.label}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
