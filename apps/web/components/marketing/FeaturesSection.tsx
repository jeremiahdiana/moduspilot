'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: '◎',
    title: 'Daily Briefing',
    desc: 'Every morning, MODUS reaches out — not the other way around. Energy check-in, approval queue, top 3 priorities, and loose ends from yesterday. In your inbox before you open your eyes.',
    size: 'large',
  },
  {
    icon: '◆',
    title: 'Approve / Redirect Queue',
    desc: 'Every action MODUS wants to take surfaces as a card. See exactly what it plans to do. Approve, edit, or skip. Nothing executes without you.',
    size: 'normal',
  },
  {
    icon: '◈',
    title: 'Goal → Habit → Task Engine',
    desc: 'Set a macro goal in chat. MODUS breaks it into weekly milestones and daily micro-actions — and adjusts automatically when you fall behind.',
    size: 'normal',
  },
  {
    icon: '◉',
    title: 'Comms Triage',
    desc: 'Reads your email. Categorizes by urgency. Drafts responses as approval cards. You stop opening Gmail to check — MODUS tells you when it needs you.',
    size: 'normal',
  },
  {
    icon: '⊙',
    title: 'Context Memory',
    desc: 'Remembers everything across every platform, conversation, and integration — goals, patterns, relationships, commitments, open loops. The longer you use MODUS, the more precisely it knows you.',
    size: 'large',
  },
  {
    icon: '⊕',
    title: 'Command Bar',
    desc: 'Natural language override on every platform. ⌘K on Mac and web, swipe-up on iOS. One message, cross-app execution, one approval card.',
    size: 'normal',
  },
  {
    icon: '▣',
    title: 'Pattern Recognition',
    desc: 'Spots what you can\'t. Repeated deferrals, energy dips, misaligned priorities. Named once, neutrally. This is the moat.',
    size: 'normal',
  },
  {
    icon: '◇',
    title: 'Focus Protection',
    desc: 'Actively defends your deep work blocks. Mutes notifications, reschedules conflicts, proposes changes via approval cards — so you never have to.',
    size: 'normal',
  },
  {
    icon: '⊞',
    title: 'Weekly Review',
    desc: 'Every Sunday: what you accomplished, what slipped, patterns noticed, recalibrated plan for the week ahead. Automatically.',
    size: 'normal',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">
            Everything You're Managing Right Now.<br />Automated.
          </h2>
          <p className="text-muted text-lg max-w-xl mx-auto">
            MODUS handles the cognitive load. You handle the decisions.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              variants={item}
              className={`bg-panel border border-border rounded-2xl p-6 hover:border-brand/30 transition-all group ${
                f.size === 'large' ? 'md:col-span-1 md:row-span-1' : ''
              } ${i === 0 ? 'md:col-span-2' : ''} ${i === 4 ? 'md:col-span-2' : ''}`}
            >
              <div className="text-2xl mb-4 text-brand/70 group-hover:text-brand transition-colors">{f.icon}</div>
              <h3 className="text-base font-bold text-text mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
