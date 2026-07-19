'use client';

import { motion } from 'framer-motion';

/* Clean line icons, brand-tinted. Stroke inherits currentColor. */
const icons = {
  models: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="m3 12 9 4.5L21 12" /><path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  ),
  create: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-4.5-4.5L6 21" />
    </svg>
  ),
  briefing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v3M4.2 6.2l2.1 2.1M2 14h3M19 14h3M17.7 8.3l2.1-2.1" /><path d="M6 20h12M8 14a4 4 0 0 1 8 0" />
    </svg>
  ),
  approve: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 6v5.5c0 4.3 3.1 7.6 7.5 9 4.4-1.4 7.5-4.7 7.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4.5" />
    </svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  memory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5A3 3 0 0 0 6.6 9a3 3 0 0 0-1 5.2A3 3 0 0 0 9.5 19a2.5 2.5 0 0 0 2.5-2.5V6.9a2.5 2.5 0 0 0-2.5-2.4Z" />
      <path d="M14.5 4.5A3 3 0 0 1 17.4 9a3 3 0 0 1 1 5.2A3 3 0 0 1 14.5 19a2.5 2.5 0 0 1-2.5-2.5" />
    </svg>
  ),
};

const FEATURES = [
  {
    icon: icons.models,
    tag: 'Every model',
    title: 'Every AI model, one chat',
    desc: 'Claude, GPT-5.6, Gemini, Llama. Pick the model you want, or let MODUS auto-route each task to the best one — switch anytime, right in the chat.',
  },
  {
    icon: icons.create,
    tag: 'Make things',
    title: 'Create images & documents',
    desc: 'Ask MODUS to generate an image or a formatted PDF, then edit it in a live canvas and download it — all inside the same conversation.',
  },
  {
    icon: icons.briefing,
    tag: 'Every morning',
    title: 'Daily briefing',
    desc: 'MODUS comes to you, not the other way around. Energy check, top 3 priorities, inbox triage, habit streaks — done before you open Gmail.',
  },
  {
    icon: icons.approve,
    tag: 'You decide',
    title: 'You approve everything',
    desc: 'Every action surfaces as an approval card. See exactly what MODUS plans to do, edit anything, skip anything. Nothing executes without your sign-off.',
  },
  {
    icon: icons.goals,
    tag: 'Follow through',
    title: 'Goals, habits, tasks',
    desc: 'Set a goal in chat. MODUS breaks it into milestones, links daily habits, and surfaces tasks automatically — adjusting when life gets in the way.',
  },
  {
    icon: icons.memory,
    tag: 'It remembers',
    title: 'Memory that persists',
    desc: 'Remembers your goals, decisions, and commitments across every conversation. The longer you use MODUS, the more precisely it knows you.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-14"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">What MODUS does</p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text leading-tight max-w-2xl">
            One place for every model — and everything after the answer.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08, ease: 'easeOut' }}
              className="group relative bg-panel rounded-2xl p-6 ring-1 ring-border/60 overflow-hidden transition-all duration-300 hover:ring-brand/30 hover:-translate-y-0.5"
            >
              {/* accent hairline that lights up on hover */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* soft brand glow, corner */}
              <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-brand/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative flex items-center gap-3 mb-4">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand/12 text-brand-light ring-1 ring-brand/20 [&_svg]:w-5 [&_svg]:h-5">
                  {f.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted/70">{f.tag}</span>
              </div>
              <h3 className="relative text-lg font-bold text-text mb-2 tracking-tight">{f.title}</h3>
              <p className="relative text-sm text-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
