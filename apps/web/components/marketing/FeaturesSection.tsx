'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: '☀',
    title: 'Daily Briefing',
    desc: 'Every morning MODUS comes to you — not the other way around. Energy check, top 3 priorities, inbox triage, habit streaks. Done before you open Gmail.',
    accent: 'from-amber-500/10 to-transparent',
  },
  {
    icon: '✓',
    title: 'You Approve Everything',
    desc: 'Every action surfaces as an approval card. See exactly what MODUS plans to do. Edit anything, skip anything. Nothing executes without your sign-off.',
    accent: 'from-emerald-500/10 to-transparent',
  },
  {
    icon: '◎',
    title: 'Goals → Habits → Tasks',
    desc: 'Set a goal in chat. MODUS breaks it into milestones, links daily habits, and surfaces tasks automatically — adjusting when life gets in the way.',
    accent: 'from-brand/10 to-transparent',
  },
  {
    icon: '⊙',
    title: 'Memory That Persists',
    desc: 'Remembers your goals, decisions, and commitments across every conversation. The longer you use MODUS, the more precisely it knows you.',
    accent: 'from-violet-500/10 to-transparent',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-16"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">What MODUS does</p>
          <h2 className="text-4xl md:text-5xl font-black text-text leading-tight max-w-xl">
            Built around how you actually work.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className={`group relative bg-panel border border-border rounded-2xl p-7 overflow-hidden transition-all hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative">
                <div className="text-2xl mb-5 text-brand">{f.icon}</div>
                <h3 className="text-lg font-bold text-text mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
