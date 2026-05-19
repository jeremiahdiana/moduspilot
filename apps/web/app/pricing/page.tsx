'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';

const PLANS = [
  {
    tier: 'FREE',
    price: '$0',
    period: '/mo',
    sub: '30-day full trial, then limited. No credit card required.',
    cta: 'Start Free',
    href: '/login',
    popular: false,
    features: [
      { label: 'AI Chat (limited messages/day)', included: true },
      { label: '1 daily briefing', included: true },
      { label: 'Up to 3 active goals', included: true },
      { label: 'Basic task capture', included: true },
      { label: '7-day context memory', included: true },
      { label: 'Web + iOS access', included: true },
      { label: 'Calendar integration', included: false },
      { label: 'Email triage', included: false },
      { label: 'Voice interface', included: false },
      { label: 'Cross-app execution', included: false },
    ],
  },
  {
    tier: 'MODUS',
    price: '$24',
    period: '/mo',
    sub: 'The full operating system. Where MODUS earns its keep.',
    cta: 'Make Your Modus',
    href: '/login',
    popular: true,
    features: [
      { label: 'AI Chat — unlimited, full context', included: true },
      { label: 'Unlimited briefings', included: true },
      { label: 'Unlimited goals + habit engine', included: true },
      { label: 'Voice interface', included: true },
      { label: 'Calendar integration (read + write)', included: true },
      { label: 'Gmail / Outlook triage', included: true },
      { label: 'Habit tracker + streaks', included: true },
      { label: 'End-of-day reflection', included: true },
      { label: '90-day context memory', included: true },
      { label: 'Weekly review reports', included: true },
      { label: 'Delegation tracker', included: true },
      { label: 'Focus protection', included: true },
      { label: 'Life admin automation', included: true },
      { label: 'Pattern recognition', included: true },
      { label: 'Web + iOS + Mac access', included: true },
    ],
  },
  {
    tier: 'PILOT',
    price: '$59',
    period: '/mo',
    sub: 'For founders and executives. A fraction of a part-time EA.',
    cta: 'Fly Pilot',
    href: '/login',
    popular: false,
    features: [
      { label: 'Everything in MODUS', included: true },
      { label: 'Unlimited context memory', included: true },
      { label: 'Wearable sync (HealthKit, Oura, Whoop)', included: true },
      { label: 'Financial pulse via Plaid', included: true },
      { label: 'Relationship intelligence CRM', included: true },
      { label: 'Meeting intelligence (pre + post)', included: true },
      { label: 'Travel & logistics management', included: true },
      { label: 'Document vault', included: true },
      { label: 'Cross-app execution', included: true },
      { label: 'Slack + Notion + Linear', included: true },
      { label: 'Multi-workspace support', included: true },
      { label: 'Priority response SLA', included: true },
    ],
  },
];

const COMPARISONS = [
  { tool: 'Superhuman', price: '$30/mo', what: 'Email only' },
  { tool: 'Notion AI', price: '$10/mo', what: 'Passive notes' },
  { tool: 'Part-time EA', price: '$1,500+/mo', what: 'One person, limited hours' },
  { tool: 'MODUS', price: '$24/mo', what: 'Entire cognitive workflow', highlight: true },
];

const FAQS = [
  {
    q: 'What happens after the 30-day trial?',
    a: 'You keep access on the free tier — limited to 20 messages per day and up to 3 active goals. No credit card required to start. Upgrade anytime to unlock everything.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-in. Cancel from your account settings and you stay on your paid plan until the end of the billing period, then drop to free.',
  },
  {
    q: 'Is there annual billing?',
    a: 'Yes — annual billing gives you 2 months free on both MODUS and PILOT. Available at checkout.',
  },
  {
    q: 'What makes PILOT different from MODUS?',
    a: 'PILOT adds the executive layer: wearable health sync (Oura, Whoop, HealthKit), financial pulse via Plaid, relationship intelligence CRM, meeting intelligence, travel management, and a document vault. If you manage a team or run a company, PILOT is built for you.',
  },
  {
    q: 'Does MODUS replace my existing apps?',
    a: 'It connects to them — Gmail, Calendar, Notion, Slack — and becomes the intelligence layer on top. You don\'t abandon your tools. MODUS handles the cognitive overhead of juggling them.',
  },
  {
    q: 'Is my data private?',
    a: 'Your conversations, goals, tasks, and memories are stored securely in your personal Firestore database. MODUS reads your connected apps only to surface what matters — it never sends or publishes anything without your explicit approval.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-5 text-left gap-4"
      >
        <span className="text-sm font-medium text-text">{q}</span>
        <span className={`text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-muted pb-5 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden">
      <Navbar solid />

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <p className="text-xs font-bold tracking-widest text-[#7c3aed] uppercase mb-4">Pricing</p>
            <h1 className="text-5xl md:text-6xl font-black text-text mb-5 leading-none">
              Your Modus.<br />Your Plan.
            </h1>
            <p className="text-muted text-lg max-w-xl mx-auto leading-relaxed">
              Start free. Scale when it earns its keep.
            </p>
          </motion.div>

          {/* Why it's priced this way */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-3xl mx-auto mb-20"
          >
            <div className="bg-panel border border-border rounded-2xl p-8">
              <p className="text-xs font-bold tracking-widest text-muted uppercase mb-6">Why these numbers</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {COMPARISONS.map(c => (
                  <div
                    key={c.tool}
                    className={`rounded-xl p-5 ${
                      c.highlight
                        ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/40'
                        : 'bg-bg border border-border'
                    }`}
                  >
                    <p className={`text-2xl font-black mb-1 ${c.highlight ? 'text-brand' : 'text-muted'}`}>
                      {c.price}
                    </p>
                    <p className={`text-sm font-semibold mb-1 ${c.highlight ? 'text-text' : 'text-muted'}`}>
                      {c.tool}
                    </p>
                    <p className={`text-xs ${c.highlight ? 'text-text/70' : 'text-muted'}`}>{c.what}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted mt-6 leading-relaxed">
                Superhuman charges $30/mo for email alone. A part-time assistant runs $1,500+/mo.
                MODUS at $24 replaces an entire cognitive workflow category — goals, tasks, habits, triage, memory, and execution in one place.
                PILOT at $59 is priced against human executive assistance.
              </p>
            </div>
          </motion.div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-20">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className={`relative rounded-2xl flex flex-col border ${
                  plan.popular
                    ? 'bg-[#7c3aed]/10 border-[#7c3aed]/50 shadow-[0_0_60px_rgba(124,58,237,0.15)]'
                    : 'bg-panel border-border'
                }`}
              >
                {plan.popular && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  </>
                )}

                <div className="p-8 border-b border-border">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">{plan.tier}</p>
                  <p className="text-4xl font-black text-text mb-1">
                    {plan.price}<span className="text-base font-normal text-muted">{plan.period}</span>
                  </p>
                  <p className="text-sm text-muted mt-2 leading-relaxed">{plan.sub}</p>
                </div>

                <div className="p-8 flex-1">
                  <ul className="space-y-3">
                    {plan.features.map(f => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm">
                        <span className={`mt-0.5 shrink-0 font-bold ${f.included ? 'text-brand' : 'text-muted/40'}`}>
                          {f.included ? '◆' : '✕'}
                        </span>
                        <span className={f.included ? 'text-text/80' : 'text-muted/40 line-through'}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-8 pb-8">
                  <Link
                    href={plan.href}
                    className={`block w-full py-3.5 rounded-xl text-sm font-bold text-center transition-all ${
                      plan.popular
                        ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                        : 'border border-border text-muted hover:text-text hover:border-brand/40'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Annual note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center text-sm text-muted mb-24"
          >
            Annual billing available — 2 months free on MODUS and PILOT.
          </motion.p>

          {/* What you actually get */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="mb-24"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-text mb-3">What you actually get</h2>
              <p className="text-muted text-base">Not features. A different way of operating.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: '◎',
                  title: 'One approval, three actions',
                  body: 'Draft a reply, block your morning, reschedule your 3 PM — one message, one card, done.',
                },
                {
                  icon: '◈',
                  title: 'Memory that compounds',
                  body: 'Everything you\'ve ever said, decided, or delegated is retrieved semantically. The longer you use MODUS, the more it knows.',
                },
                {
                  icon: '◉',
                  title: 'MODUS reaches out first',
                  body: 'You don\'t open it to check. It sends the morning briefing, flags what needs you, surfaces what you\'re ignoring.',
                },
                {
                  icon: '⊞',
                  title: 'Goals → habits → tasks, automatically',
                  body: 'Set a macro goal in chat. MODUS decomposes it, tracks completion, and recalibrates when you fall behind.',
                },
                {
                  icon: '◆',
                  title: 'Nothing executes without you',
                  body: 'Every action is an approval card. You see exactly what MODUS plans to do. Approve, edit, or skip. No surprises.',
                },
                {
                  icon: '→',
                  title: 'Inbox zero as a byproduct',
                  body: 'MODUS reads email, categorizes by urgency, drafts responses. You stop opening Gmail to check — it tells you when it needs you.',
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="bg-panel border border-border rounded-xl p-6 hover:border-brand/30 transition-colors"
                >
                  <div className="text-2xl text-[#7c3aed] mb-3">{item.icon}</div>
                  <p className="text-sm font-semibold text-text mb-2">{item.title}</p>
                  <p className="text-sm text-muted leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto mb-24"
          >
            <h2 className="text-3xl font-black text-text mb-10 text-center">Questions</h2>
            <div>
              {FAQS.map(f => (
                <FAQItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-4xl md:text-5xl font-black text-text mb-4">Ready to run differently?</h2>
            <p className="text-muted text-lg mb-8 max-w-md mx-auto">
              Start free. No credit card. Cancel anytime. Your first 30 days are fully unlocked.
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-[#7c3aed] text-white font-bold rounded-xl hover:bg-[#6d28d9] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-all"
            >
              Make Your Modus — It&apos;s Free
            </Link>
            <p className="text-muted text-xs mt-4">30-day full trial · No credit card required</p>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
