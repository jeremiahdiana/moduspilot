'use client';

import { motion } from 'framer-motion';

// Concrete "say this → here's what happens" cards — the agent-to-agent magic,
// adapted from the household framing to teams/cofounders/families alike.
const EXAMPLES = [
  {
    quote: 'Invite Sarah to the group',
    detail: 'Her MODUS stays her own. Her conversations, memory, and goals stay private from yours.',
  },
  {
    quote: 'Ask Sarah when she’s free for the offsite',
    detail: 'Your MODUS asks Sarah’s MODUS for the answer. She controls what hers can share, and it only pings her when it needs to.',
  },
  {
    quote: 'Put our Tokyo trip on the group page',
    detail: 'MODUS does the quiet one-on-one planning, then keeps one shared page only the group can see.',
  },
  {
    quote: 'Who’s covering the launch while I’m out?',
    detail: 'MODUS checks across everyone’s plans, finds the gaps, and tells you what still needs an owner.',
  },
];

const PILLARS = [
  {
    title: 'Separate where it matters.',
    body: 'Every person gets their own private MODUS — their memory, their goals, their inbox. Shared only what they choose, when they choose.',
  },
  {
    title: 'Together where it counts.',
    body: 'Agents talk to each other so the group stays in sync: availability, plans, hand-offs. No more group-chat archaeology.',
  },
  {
    title: 'On every device.',
    body: 'Everyone gets MODUS on web, iPhone, and Mac. No one’s left out because they’re on the wrong computer.',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function GroupSection() {
  return (
    <section id="group" className="py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16 max-w-2xl mx-auto"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-brand">New &middot; MODUS Group</span>
          <h2 className="text-4xl md:text-5xl font-black text-text mt-4 mb-4">
            A private MODUS for everyone in the group.
          </h2>
          <p className="text-muted text-lg leading-relaxed">
            Your team, your cofounder, your household. Each person gets their own MODUS — together
            where it counts, separate where it matters.
          </p>
        </motion.div>

        {/* Example cards */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20"
        >
          {EXAMPLES.map(ex => (
            <motion.div
              key={ex.quote}
              variants={item}
              className="bg-panel border border-border rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-brand mt-1 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </span>
                <p className="text-base font-semibold text-text">&ldquo;{ex.quote}&rdquo;</p>
              </div>
              <p className="text-sm text-muted leading-relaxed pl-7">{ex.detail}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Pillars */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
        >
          {PILLARS.map(p => (
            <motion.div key={p.title} variants={item} className="text-center md:text-left">
              <h3 className="text-base font-bold text-text mb-2">{p.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing callout */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative bg-panel border border-brand rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(124,58,237,0.12)]"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
          <div className="p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
            <div className="md:flex-1">
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">GROUP</p>
              <p className="text-4xl font-black text-text mb-1">
                $79<span className="text-base font-normal text-muted">/mo</span>
              </p>
              <p className="text-sm text-muted mt-2 max-w-md">
                You plus 4 members, each with their own private MODUS. Agent-to-agent coordination,
                a shared group space, and everything in MODUS for each person.
              </p>
            </div>
            <div className="md:w-64 shrink-0">
              <ul className="space-y-2.5 mb-6">
                {['5 private agents, 1 group', 'Cross-agent availability + planning', 'Shared group page', 'Web + iOS + Mac for everyone', '7-day full trial, no card'].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="text-brand mt-0.5 shrink-0">&#9670;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/login"
                className="block w-full py-3.5 rounded-xl text-sm font-bold text-center bg-brand text-white hover:bg-brand/90 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all"
              >
                Get early access
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
