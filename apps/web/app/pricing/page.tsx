'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { MarketingBackground, ScrollProgress } from '@/components/marketing/MarketingBackground';

function RevealOnScroll({
  children,
  direction = 'up',
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px 0px' });

  const offsets: Record<string, { x: number; y: number }> = {
    up:    { x: 0,   y: 32  },
    down:  { x: 0,   y: -32 },
    left:  { x: -32, y: 0   },
    right: { x: 32,  y: 0   },
    none:  { x: 0,   y: 0   },
  };

  const { x, y } = offsets[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x, y, filter: 'blur(6px)' }}
      animate={inView ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

const PLANS = [
  {
    tier: 'MODUS',
    price: '$24',
    period: '/mo',
    sub: '3 days free, then $24/mo. Card required · cancel anytime.',
    cta: 'Start 3-day trial',
    href: '/login',
    popular: true,
    accent: 'from-brand/20 to-violet-600/10',
    glow: '0 0 80px rgba(124,58,237,0.25), 0 0 160px rgba(124,58,237,0.1)',
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
    cta: 'Start 3-day trial',
    href: '/login',
    popular: false,
    accent: 'from-indigo-500/10 to-purple-600/5',
    glow: '0 0 40px rgba(124,58,237,0.12)',
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

const GROUP_FEATURES = [
  '5 seats — each a full, separate MODUS',
  'Everything in MODUS, for every member',
  'A shared group space for trips & plans',
  'Ask MODUS when a teammate is free',
  'Web + iOS + Mac for everyone',
  '7-day full trial, no card required',
];

const COMPARISONS = [
  { tool: 'Superhuman', price: '$30/mo', what: 'Email only', icon: '✉' },
  { tool: 'Notion AI', price: '$10/mo', what: 'Passive notes', icon: '◻' },
  { tool: 'Part-time EA', price: '$1,500+/mo', what: 'One person, limited hours', icon: '◷' },
  { tool: 'MODUS', price: '$24/mo', what: 'Entire cognitive workflow', highlight: true, icon: '◆' },
];

const FAQS = [
  {
    q: 'What happens after the 3-day trial?',
    a: 'Your card is billed for the plan you chose ($24/mo MODUS or $59/mo PILOT) and you keep full access. We notify you before the trial ends, and you can cancel anytime during the 3 days at no charge.',
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
    q: 'How does the Group plan work?',
    a: 'One Group plan covers up to 5 people for $79/mo. The owner subscribes and invites the rest by email — each member gets their own separate MODUS with their own account and data, and they join at no extra cost. The group shares a space for trips and plans, and MODUS can check a teammate\'s availability, but only what each person chooses to share is ever shared.',
  },
  {
    q: 'Does MODUS replace my existing apps?',
    a: "It connects to them — Gmail, Calendar, Notion, Slack — and becomes the intelligence layer on top. You don't abandon your tools. MODUS handles the cognitive overhead of juggling them.",
  },
  {
    q: 'Is my data private?',
    a: "Your conversations, goals, tasks, and memories are stored securely in your personal Firestore database. MODUS reads your connected apps only to surface what matters — it never sends or publishes anything without your explicit approval.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-5 text-left gap-4 group"
      >
        <span className="text-sm font-medium text-text group-hover:text-brand transition-colors">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted shrink-0 text-lg leading-none group-hover:text-brand transition-colors"
        >
          +
        </motion.span>
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
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <ScrollProgress />
      <MarketingBackground />
      <Navbar solid />

      <div className="relative pt-32 pb-24 px-6" style={{ zIndex: 2 }}>
        <div className="max-w-6xl mx-auto">

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-brand uppercase">Pricing</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-6xl md:text-7xl lg:text-8xl font-black leading-none mb-6"
            >
              <span className="text-text">Your </span>
              <span className="hero-gradient-text">Modus.</span>
              <br />
              <span className="text-text">Your Plan.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-muted text-xl max-w-lg mx-auto leading-relaxed mb-10"
            >
              Try it free for 3 days. Card required · cancel anytime.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-6 text-sm text-muted"
            >
              {['3-day free trial', 'Card required', 'Cancel anytime'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="text-brand">◆</span>
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Decorative divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex items-center justify-center py-12"
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
            <div className="mx-4 w-2 h-2 rounded-full bg-brand/40" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
          </motion.div>

          {/* ── Value comparison ──────────────────────────────────────── */}
          <RevealOnScroll className="max-w-4xl mx-auto mb-24">
            <div className="bg-panel/60 backdrop-blur-xl border border-border/80 rounded-3xl p-8 shadow-2xl shadow-brand/5">
              <p className="text-xs font-bold tracking-widest text-muted uppercase mb-8 text-center">Why these numbers</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {COMPARISONS.map((c, i) => (
                  <RevealOnScroll key={c.tool} delay={i * 0.08} direction="up">
                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className={`rounded-2xl p-5 text-center transition-all ${
                        c.highlight
                          ? 'bg-gradient-to-br from-brand/25 to-violet-600/15 border border-brand/50 shadow-lg shadow-brand/20'
                          : 'bg-bg/60 border border-border/60 hover:border-brand/20'
                      }`}
                    >
                      <div className={`text-2xl mb-2 ${c.highlight ? 'text-brand' : 'text-muted/50'}`}>{c.icon}</div>
                      <p className={`text-xl font-black mb-1 ${c.highlight ? 'text-brand' : 'text-muted'}`}>
                        {c.price}
                      </p>
                      <p className={`text-xs font-bold mb-1 ${c.highlight ? 'text-text' : 'text-muted/70'}`}>
                        {c.tool}
                      </p>
                      <p className={`text-[11px] leading-snug ${c.highlight ? 'text-text/70' : 'text-muted/60'}`}>{c.what}</p>
                    </motion.div>
                  </RevealOnScroll>
                ))}
              </div>
              <RevealOnScroll direction="none" delay={0.3}>
                <p className="text-sm text-muted mt-8 leading-relaxed text-center max-w-2xl mx-auto">
                  Superhuman charges $30/mo for email alone. A part-time assistant runs $1,500+/mo.
                  MODUS at $24 replaces an entire cognitive workflow — goals, tasks, habits, triage, memory, and execution in one place.
                </p>
              </RevealOnScroll>
            </div>
          </RevealOnScroll>

          {/* ── Plan cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-6">
            {PLANS.map((plan, i) => (
              <RevealOnScroll key={plan.tier} delay={i * 0.12} direction="up">
                <motion.div
                  whileHover={plan.popular ? { y: -6 } : { y: -3 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`relative rounded-3xl flex flex-col border overflow-hidden group ${
                    plan.popular
                      ? 'bg-panel/70 backdrop-blur-xl border-brand/50'
                      : 'bg-panel/60 backdrop-blur-xl border-border/70'
                  }`}
                  style={{ boxShadow: plan.glow || undefined }}
                >
                  {/* Gradient overlay that intensifies on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${plan.accent} opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                  {plan.popular && (
                    <>
                      {/* Top shimmer line */}
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />
                      {/* Popular badge */}
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-brand text-white text-[11px] font-bold px-4 py-1 rounded-full shadow-lg shadow-brand/40">
                          Most Popular
                        </span>
                      </div>
                    </>
                  )}

                  <div className="relative p-8 border-b border-border/60">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">{plan.tier}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-5xl font-black ${plan.popular ? 'text-brand' : 'text-text'}`}>
                        {plan.price}
                      </span>
                      <span className="text-base font-normal text-muted mb-2">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">{plan.sub}</p>
                  </div>

                  <div className="relative p-8 flex-1">
                    <ul className="space-y-3">
                      {plan.features.map(f => (
                        <li key={f.label} className="flex items-start gap-2.5 text-sm">
                          <span className={`mt-0.5 shrink-0 text-xs ${f.included ? 'text-brand' : 'text-muted/30'}`}>
                            {f.included ? '◆' : '✕'}
                          </span>
                          <span className={f.included ? 'text-text/80' : 'text-muted/30 line-through'}>
                            {f.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative px-8 pb-8">
                    <Link
                      href={plan.href}
                      className={`block w-full py-4 rounded-2xl text-sm font-bold text-center transition-all ${
                        plan.popular
                          ? 'btn-primary text-white'
                          : 'border border-border/80 text-muted hover:text-text hover:border-brand/40 hover:bg-brand/5 backdrop-blur-sm'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </motion.div>
              </RevealOnScroll>
            ))}
          </div>

          {/* ── Group plan (multi-seat) ──────────────────────────────── */}
          <RevealOnScroll direction="up" className="mb-6">
            <div
              className="relative rounded-3xl border border-brand/40 bg-panel/60 backdrop-blur-xl overflow-hidden"
              style={{ boxShadow: '0 0 40px rgba(124,58,237,0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent pointer-events-none" />
              <div className="relative p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="md:flex-1">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">GROUP</p>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-5xl font-black text-text">$79</span>
                    <span className="text-base font-normal text-muted mb-2">/mo</span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed max-w-md">
                    For teams, cofounders, and households. Up to 5 people, each with their own full
                    MODUS, coordinating through one shared group. The owner&rsquo;s plan covers
                    everyone — invited members join free.
                  </p>
                </div>
                <div className="md:w-72 shrink-0">
                  <ul className="space-y-3 mb-6">
                    {GROUP_FEATURES.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 shrink-0 text-xs text-brand">◆</span>
                        <span className="text-text/80">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="block w-full py-4 rounded-2xl text-sm font-bold text-center btn-primary text-white">
                    Get started
                  </Link>
                </div>
              </div>
            </div>
          </RevealOnScroll>

          {/* Annual note */}
          <RevealOnScroll direction="none">
            <p className="text-center text-sm text-muted mb-24 mt-6">
              Annual billing available —{' '}
              <span className="text-brand font-semibold">2 months free</span>
              {' '}on MODUS and PILOT.
            </p>
          </RevealOnScroll>

          {/* ── What you actually get ─────────────────────────────────── */}
          <RevealOnScroll className="mb-6">
            <div className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl font-black text-text mb-3">What you actually get</h2>
              <p className="text-muted text-lg">Not features. A different way of operating.</p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-24">
            {[
              {
                icon: '◎',
                title: 'One approval, three actions',
                body: 'Draft a reply, block your morning, reschedule your 3 PM — one message, one card, done.',
                color: 'from-violet-500/20 to-purple-600/10',
              },
              {
                icon: '◈',
                title: 'Memory that compounds',
                body: "Everything you've ever said, decided, or delegated is retrieved semantically. The longer you use MODUS, the more it knows.",
                color: 'from-indigo-500/15 to-violet-600/8',
              },
              {
                icon: '◉',
                title: 'MODUS reaches out first',
                body: "You don't open it to check. It sends the morning briefing, flags what needs you, surfaces what you're ignoring.",
                color: 'from-purple-500/15 to-brand/8',
              },
              {
                icon: '⊞',
                title: 'Goals → habits → tasks',
                body: 'Set a macro goal in chat. MODUS decomposes it, tracks completion, and recalibrates when you fall behind.',
                color: 'from-brand/15 to-violet-500/8',
              },
              {
                icon: '◆',
                title: 'Nothing executes without you',
                body: 'Every action is an approval card. You see exactly what MODUS plans to do. Approve, edit, or skip. No surprises.',
                color: 'from-violet-600/20 to-purple-500/10',
              },
              {
                icon: '→',
                title: 'Inbox zero as a byproduct',
                body: 'MODUS reads email, categorizes by urgency, drafts responses. You stop opening Gmail to check — it tells you when it needs you.',
                color: 'from-indigo-400/15 to-brand/8',
              },
            ].map((item, i) => (
              <RevealOnScroll key={item.title} delay={i * 0.07} direction="up">
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 350 }}
                  className={`group relative bg-panel/60 backdrop-blur-xl border border-border/70 rounded-2xl p-6 overflow-hidden cursor-default h-full`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  <div className="relative">
                    <div className="text-3xl text-brand mb-4 group-hover:scale-110 transition-transform duration-200 inline-block">{item.icon}</div>
                    <p className="text-sm font-bold text-text mb-2">{item.title}</p>
                    <p className="text-sm text-muted leading-relaxed">{item.body}</p>
                  </div>
                </motion.div>
              </RevealOnScroll>
            ))}
          </div>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <RevealOnScroll className="max-w-2xl mx-auto mb-28">
            <div className="bg-panel/60 backdrop-blur-xl border border-border/70 rounded-3xl p-8 shadow-xl shadow-brand/5">
              <h2 className="text-3xl font-black text-text mb-8 text-center">Questions</h2>
              <div>
                {FAQS.map(f => (
                  <FAQItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* ── Final CTA ────────────────────────────────────────────── */}
          <RevealOnScroll direction="none">
            <div className="relative rounded-3xl overflow-hidden">
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-violet-600/10 to-purple-800/20 backdrop-blur-xl" />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(124,58,237,0.18), transparent)' }} />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

              <div className="relative text-center py-20 px-8">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-xs font-bold tracking-widest text-brand uppercase mb-6"
                >
                  Start Today
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-5xl md:text-6xl font-black text-text mb-5 leading-none"
                >
                  Ready to run<br />
                  <span className="hero-gradient-text">differently?</span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-muted text-lg mb-10 max-w-md mx-auto leading-relaxed"
                >
                  3 days free, then billed monthly. Cancel anytime.<br />Your first 3 days are fully unlocked.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <Link
                    href="/login"
                    className="btn-primary inline-block px-10 py-4 text-white font-bold rounded-2xl text-base"
                  >
                    Start Your 3-Day Trial
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="btn-glass inline-block px-8 py-4 text-text font-semibold rounded-2xl text-sm border border-border/60"
                  >
                    See How It Works →
                  </Link>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                  className="text-muted text-xs mt-6"
                >
                  3-day free trial · card required · cancel anytime
                </motion.p>
              </div>
            </div>
          </RevealOnScroll>

        </div>
      </div>
    </main>
  );
}
