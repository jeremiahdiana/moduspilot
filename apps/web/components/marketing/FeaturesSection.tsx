'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    title: 'Every AI Model, One Chat',
    desc: 'Claude, GPT-5.6, Gemini, Llama. Pick the model you want, or let MODUS auto-route each task to the best one. Switch anytime, right in the chat.',
  },
  {
    title: 'Create Images & Documents',
    desc: 'Ask MODUS to generate an image or a formatted PDF, then edit the document in a live canvas and download it. All inside the same conversation.',
  },
  {
    title: 'Daily Briefing',
    desc: 'Every morning MODUS comes to you, not the other way around. Energy check, top 3 priorities, inbox triage, habit streaks. Done before you open Gmail.',
  },
  {
    title: 'You Approve Everything',
    desc: 'Every action surfaces as an approval card. See exactly what MODUS plans to do. Edit anything, skip anything. Nothing executes without your sign-off.',
  },
  {
    title: 'Goals, Habits, Tasks',
    desc: 'Set a goal in chat. MODUS breaks it into milestones, links daily habits, and surfaces tasks automatically, adjusting when life gets in the way.',
  },
  {
    title: 'Memory That Persists',
    desc: 'Remembers your goals, decisions, and commitments across every conversation. The longer you use MODUS, the more precisely it knows you.',
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
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text leading-tight max-w-xl">
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
              className="group relative bg-panel rounded-2xl p-7 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/30"
            >
              <h3 className="text-lg font-bold text-text mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
