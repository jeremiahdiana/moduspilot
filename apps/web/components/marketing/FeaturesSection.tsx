'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: '◎',
    title: 'Daily Briefing',
    desc: 'Every morning, MODUS reaches out — not the other way around. Energy check-in, top 3 priorities, overdue tasks, and habit streaks at risk. In your browser before you open your inbox.',
    size: 'large',
    span2: true,
  },
  {
    icon: '◆',
    title: 'Approve / Redirect',
    desc: 'Every action surfaces as an approval card. See exactly what MODUS plans to do. Approve, edit, or skip. Nothing executes without you.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '◈',
    title: 'Goal → Habit → Task Engine',
    desc: 'Set a goal in chat. MODUS breaks it into milestones, links daily habits, and surfaces tasks automatically — adjusting when you fall behind.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '◉',
    title: 'Email & Calendar Triage',
    desc: 'Reads your Gmail. Categorizes by urgency. Drafts replies as approval cards. Pulls today\'s meetings into your briefing automatically.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '⊙',
    title: 'Cross-Conversation Memory',
    desc: 'Remembers everything — goals, decisions, commitments, patterns — across every session. The longer you use MODUS, the more precisely it knows you.',
    size: 'large',
    span2: true,
  },
  {
    icon: '⊕',
    title: 'Bring Your Own Model',
    desc: 'Use MODUS with Groq (default), your own OpenAI key for GPT-4o, or your own Anthropic key for Claude. You choose the brain. MODUS is the OS.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '▣',
    title: 'Pattern Recognition',
    desc: 'Spots what you can\'t. Repeated deferrals, energy dips, misaligned priorities. Named once, neutrally. This is the moat.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '◇',
    title: 'Focus Protection',
    desc: 'Actively defends your deep work blocks. Mutes notifications, reschedules conflicts, proposes changes via approval cards.',
    size: 'normal',
    span2: false,
  },
  {
    icon: '⊞',
    title: 'Cmd+K Global Search',
    desc: 'Search every goal, task, habit, and conversation from anywhere. Or ask MODUS a question. One shortcut. Your entire life.',
    size: 'normal',
    span2: false,
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
            MODUS handles the cognitive load. You handle the decisions that actually matter.
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
                f.span2 ? 'md:col-span-2' : ''
              }`}
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
