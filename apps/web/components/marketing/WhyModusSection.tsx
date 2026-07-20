'use client';

import { motion } from 'framer-motion';

type Card = { title: string; body: string; icon: React.ReactNode };

const CARDS: Card[] = [
  {
    title: 'Every model, one bill',
    body: 'Claude, GPT-5.6, Gemini, Llama and DeepSeek live in one chat. Pick the one you want per message, or leave it on Auto. No juggling five subscriptions.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </svg>
    ),
  },
  {
    title: 'It actually knows you',
    body: 'Persistent memory across every conversation, plus a daily briefing on your priorities, habits and inbox. Not a blank box that forgets you the moment you close the tab.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a4 4 0 0 0-4 4c-1.5.5-2.5 2-2.5 3.5 0 1 .4 1.9 1 2.6-.3.6-.5 1.2-.5 1.9A3.5 3.5 0 0 0 9.5 21 3 3 0 0 0 12 19.5 3 3 0 0 0 14.5 21 3.5 3.5 0 0 0 18 17.5c0-.7-.2-1.3-.5-1.9.6-.7 1-1.6 1-2.6 0-1.5-1-3-2.5-3.5A4 4 0 0 0 12 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v16.5" />
      </svg>
    ),
  },
  {
    title: 'It acts — with your approval',
    body: 'Connected to Gmail, Calendar, Notion, Slack, iMessage and more, MODUS drafts the email and blocks the time. Every action waits on an approval card. You make the call.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
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
          <h2 className="text-4xl md:text-5xl text-text tracking-tight mb-4">
            Not another chatbot
          </h2>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto">
            Everything ChatGPT isn&apos;t: every model, real memory, and the ability to get things done.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
              className="rounded-2xl border border-border bg-panel p-7"
            >
              <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center mb-5">
                {c.icon}
              </div>
              <h3 className="text-xl text-text mb-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
                {c.title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
