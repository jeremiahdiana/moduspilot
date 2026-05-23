'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const FAQS = [
  {
    q: 'What does MODUS actually do day-to-day?',
    a: "Every morning MODUS sends you a briefing — energy check-in, top 3 priorities, overdue tasks, habits at risk. During the day you can message it to draft emails, reschedule meetings, update goals, or log habits. It queues every action as an approval card before anything runs. You're always in control.",
  },
  {
    q: 'How is this different from just using ChatGPT?',
    a: "ChatGPT answers questions in a vacuum. MODUS has persistent memory across every conversation, connects to your Gmail and Google Calendar, tracks your goals and habits over time, and proactively reaches out to you — you don't go to it. Different category entirely.",
  },
  {
    q: 'Can I use my own OpenAI or Claude API key?',
    a: 'Yes. Under Settings → Model, you can connect your own OpenAI key (GPT-4o) or Anthropic key (Claude). MODUS handles all the orchestration — you just bring the brain. The default uses Groq at no extra cost.',
  },
  {
    q: 'What integrations does MODUS support?',
    a: 'Gmail and Google Calendar are live today. MODUS reads your inbox, categorizes by urgency, drafts replies, and syncs your meetings into your daily briefing. iOS, Mac app, and Telegram are coming next.',
  },
  {
    q: 'Is my data private?',
    a: "Your data is never sold or used to train AI models. Memory is stored in your own encrypted Firestore and Pinecone index. You can view and delete everything MODUS knows about you at any time from Settings → Memory.",
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. No lock-in. Cancel from your account settings or email us and we'll handle it same day. You keep access until the end of your billing period.",
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border border-border rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-panel hover:bg-panel/80 transition-colors group"
      >
        <span className="text-sm font-semibold text-text pr-4">{q}</span>
        <span className={`text-brand text-lg shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-6 py-4 text-sm text-muted leading-relaxed border-t border-border bg-bg/30">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQSection() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">Questions</h2>
          <p className="text-muted text-lg">Everything you'd ask before signing up.</p>
        </motion.div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
