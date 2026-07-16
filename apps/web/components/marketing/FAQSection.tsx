'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const FAQS = [
  {
    q: 'What does MODUS actually do day-to-day?',
    a: "Every morning MODUS sends you a briefing: energy check-in, top 3 priorities, overdue tasks, habits at risk. During the day you can message it to draft emails, reschedule meetings, update goals, or log habits. It queues every action as an approval card before anything runs. You're always in control.",
  },
  {
    q: 'How is this different from just using ChatGPT?',
    a: "ChatGPT answers questions in a vacuum. MODUS has persistent memory across every conversation, connects to your Gmail and Google Calendar, tracks your goals and habits over time, and proactively reaches out to you. You don't go to it. Different category entirely.",
  },
  {
    q: 'Which AI models does MODUS use?',
    a: "Claude, GPT-5.6, Gemini and Llama all live in one chat. Pick the model you want for any message, or leave it on Auto and MODUS routes each task to the best one. MODUS ($24) gives you every provider, auto-routed; PILOT ($59) adds the frontier models — GPT-5.6 Sol, Claude Opus and Claude Fable 5, Anthropic’s most capable — with manual pick per message.",
  },
  {
    q: 'Can I use my own OpenAI or Claude API key?',
    a: 'Yes. Under Settings → Brain you can connect your own OpenAI or Anthropic key, or just use the models MODUS already includes, no key needed. Either way MODUS handles the orchestration and routing.',
  },
  {
    q: 'Can MODUS create images and PDFs?',
    a: 'Yes. Ask MODUS to generate an image or a document and it makes it right in the chat: images you can download, and formatted PDFs you can edit in a live canvas before exporting.',
  },
  {
    q: 'What integrations does MODUS support?',
    a: 'On the web: Gmail, Google Calendar, Drive, Notion, Slack and GitHub. MODUS reads your inbox, drafts replies, and syncs meetings into your briefing. On your Mac and iPhone it also reaches iMessage, Apple Notes, Reminders, Contacts, Photos, Apple Health, iCloud files and even your Obsidian vault. The Mac app is live and the iPhone app is in beta.',
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
      className="rounded-xl overflow-hidden"
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
            <p className="px-6 py-4 text-sm text-muted leading-relaxed bg-bg/60">
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
    <section className="py-32 px-6 overflow-hidden">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text mb-4">Questions</h2>
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
