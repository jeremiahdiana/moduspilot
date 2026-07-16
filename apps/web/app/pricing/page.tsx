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
    features: [
      { label: 'AI Chat, unlimited with full context', included: true },
      { label: 'Every provider, auto-routed: GPT-5.6, Claude, Gemini, Llama', included: true },
      { label: 'Generate images & editable PDFs', included: true },
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
      { label: 'Web + Mac apps live · iPhone in beta', included: true },
    ],
  },
  {
    tier: 'PILOT',
    price: '$59',
    period: '/mo',
    sub: 'For founders and executives. 3 days free, then $59/mo.',
    cta: 'Start 3-day trial',
    href: '/login',
    popular: false,
    features: [
      { label: 'Everything in MODUS', included: true },
      { label: 'The frontier models: GPT-5.6 Sol + Claude Opus, manual pick per message', included: true },
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
  '5 seats, each a full separate MODUS',
  'Everything in MODUS, for every member',
  'A shared group space for trips & plans',
  'Ask MODUS when a teammate is free',
  'Web + Mac + iPhone (beta) for everyone',
  '7-day full trial, no card required',
];

const COMPARISONS = [
  // $140 is the ITEMISED total of six real subscriptions MODUS actually replaces
  // (see StackSection). The old "$200+/mo" was attached to three products costing
  // ~$60 — 3 x $20 does not make $200, and $200 is ChatGPT PRO, one tier. A number
  // a reader can disprove in their head costs more than the drama buys.
  { tool: 'ChatGPT + Claude + Gemini + Perplexity + Midjourney', price: '$110/mo', what: 'Five tabs, five bills, none of them know you' },
  { tool: 'Superhuman', price: '$30/mo', what: 'Email only' },
  { tool: 'Part-time EA', price: '$1,500+/mo', what: 'One person, limited hours' },
  { tool: 'MODUS', price: '$24/mo', what: 'Every provider + your entire workflow', highlight: true },
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
    a: 'Yes. Annual billing gives you 2 months free on both MODUS and PILOT. Available at checkout.',
  },
  {
    q: 'What makes PILOT different from MODUS?',
    a: 'PILOT adds the executive layer: wearable health sync (Oura, Whoop, HealthKit), financial pulse via Plaid, relationship intelligence CRM, meeting intelligence, travel management, and a document vault. If you manage a team or run a company, PILOT is built for you.',
  },
  {
    q: 'How does the Group plan work?',
    a: 'One Group plan covers up to 5 people for $79/mo. The owner subscribes and invites the rest by email. Each member gets their own separate MODUS with their own account and data, and joins at no extra cost. The group shares a space for trips and plans, and MODUS can check a teammate\'s availability, but only what each person chooses to share is ever shared.',
  },
  {
    q: 'Does MODUS replace my other AI subscriptions?',
    a: "Yes. That's the point. ChatGPT Plus is $20, Claude Pro $20, Google AI Pro $20, Perplexity Pro $20 and Midjourney $30. That's $110/mo, and you still have to pick the right tab yourself. MODUS gives you every frontier model in one place for $24, routes each task to whichever one is best, and remembers everything across all of them. Cancel the rest. Your everyday tools (Gmail, Calendar, Notion, Slack) you keep, and MODUS runs on top of them.",
  },
  {
    q: 'Is my data private?',
    a: "Your conversations, goals, tasks, and memories are stored securely in your personal Firestore database. MODUS reads your connected apps only to surface what matters. It never sends or publishes anything without your explicit approval.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-text/[0.06] last:border-0">
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
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 backdrop-blur-sm mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-brand dark:text-brand-light uppercase">Pricing</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.08] tracking-tight mb-6"
            >
              <span className="text-brand dark:text-brand-light">Your Modus.</span>
              <br />
              <span className="text-text">Your Plan.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-muted text-xl max-w-2xl mx-auto leading-relaxed mb-6"
            >
              Write with Gemini, research with Claude, ask ChatGPT. Every frontier model in one subscription, with far higher limits than paying for any of them alone.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted bg-panel rounded-full px-4 py-2 mb-8"
            >
              <span className="text-text font-semibold">Replaces</span>
              <span>ChatGPT Plus</span><span className="text-muted/40">+</span>
              <span>Claude Pro</span><span className="text-muted/40">+</span>
              <span>Gemini Advanced</span>
              <span className="text-brand dark:text-brand-light font-semibold">for less.</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex items-center justify-center gap-6 text-sm text-muted"
            >
              {['3-day free trial', 'Card required', 'Cancel anytime'].map((t, i) => (
                <span key={t} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="hidden sm:block w-px h-3 bg-muted/25" />}
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
            <div className="bg-panel rounded-3xl p-8 shadow-2xl shadow-black/30">
              <p className="text-xs font-bold tracking-widest text-muted uppercase mb-8 text-center">Why these numbers</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {COMPARISONS.map((c, i) => (
                  <RevealOnScroll key={c.tool} delay={i * 0.08} direction="up" className="h-full">
                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className={`h-full rounded-2xl p-5 text-center transition-all ${
                        c.highlight
                          ? 'bg-brand/10 ring-1 ring-brand/30 shadow-lg shadow-brand/10'
                          : 'bg-text/[0.04]'
                      }`}
                    >
                      <p className={`text-xl font-semibold mb-1 ${c.highlight ? 'text-brand dark:text-brand-light' : 'text-muted'}`}>
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
                  ChatGPT Plus, Claude Pro, Google AI Pro, Perplexity and Midjourney come to $110/mo, and none
                  of them know your calendar, your inbox, or what you decided last week. MODUS is $24, gives you all of
                  them, and puts them to work on your actual life.
                </p>
              </RevealOnScroll>
            </div>
          </RevealOnScroll>

          {/* ── Plan cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pt-5 max-w-3xl mx-auto">
            {PLANS.map((plan, i) => (
              <RevealOnScroll key={plan.tier} delay={i * 0.12} direction="up">
                <div className="relative h-full">
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                    <span className="btn-primary inline-block text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                <motion.div
                  whileHover={plan.popular ? { y: -6 } : { y: -3 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`relative rounded-3xl flex flex-col overflow-hidden group h-full bg-panel ${
                    plan.popular
                      ? 'shadow-2xl shadow-black/60 ring-1 ring-brand/25'
                      : 'shadow-xl shadow-black/30'
                  }`}
                >
                  {plan.popular && (
                    /* Top edge catches the accent */
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
                  )}

                  <div className="relative p-8">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">{plan.tier}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-5xl font-semibold tracking-tight ${plan.popular ? 'text-brand dark:text-brand-light' : 'text-text'}`}>
                        {plan.price}
                      </span>
                      <span className="text-base font-normal text-muted mb-2">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">{plan.sub}</p>
                  </div>
                  <div className="mx-8 h-px bg-text/[0.06]" />

                  <div className="relative p-8 flex-1">
                    <ul className="space-y-3">
                      {plan.features.map(f => (
                        <li key={f.label} className="flex items-start gap-2.5 text-sm">
                          <span
                            aria-hidden
                            className={`mt-2 shrink-0 w-1 h-1 rounded-full ${f.included ? 'bg-brand' : 'bg-muted/30'}`}
                          />
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
                      className="btn-primary block w-full py-4 rounded-2xl text-sm font-bold text-center text-white transition-all hover:scale-[1.02] active:scale-100"
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </motion.div>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          {/* ── Group plan (multi-seat) ──────────────────────────────── */}
          <RevealOnScroll direction="up" className="mb-6">
            <div className="relative rounded-3xl bg-panel overflow-hidden shadow-xl shadow-black/30">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
              <div className="relative p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="md:flex-1">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">GROUP</p>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-5xl font-semibold tracking-tight text-text">$79</span>
                    <span className="text-base font-normal text-muted mb-2">/mo</span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed max-w-md">
                    For teams, cofounders, and households. Up to 5 people, each with their own full
                    MODUS, coordinating through one shared group. The owner&rsquo;s plan covers
                    everyone, and invited members join free.
                  </p>
                </div>
                <div className="md:w-72 shrink-0">
                  <ul className="space-y-3 mb-6">
                    {GROUP_FEATURES.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span aria-hidden className="mt-2 shrink-0 w-1 h-1 rounded-full bg-brand" />
                        <span className="text-text/80">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="block w-full py-4 rounded-2xl text-sm font-bold text-center btn-primary text-white transition-all hover:scale-[1.02] active:scale-100">
                    Get started
                  </Link>
                </div>
              </div>
            </div>
          </RevealOnScroll>

          {/* Annual note */}
          <RevealOnScroll direction="none">
            <p className="text-center text-sm text-muted mb-24 mt-6">
              Annual billing available,{' '}
              <span className="text-brand font-semibold">2 months free</span>
              {' '}on MODUS and PILOT.
            </p>
          </RevealOnScroll>

          {/* ── What you actually get ─────────────────────────────────── */}
          <RevealOnScroll className="mb-6">
            <div className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text mb-3">What you actually get</h2>
              <p className="text-muted text-lg">Not features. A different way of operating.</p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-24">
            {[
              {
                title: 'One approval, three actions',
                body: 'Draft a reply, block your morning, reschedule your 3 PM. One message, one card, done.',
              },
              {
                title: 'Memory that compounds',
                body: "Everything you've ever said, decided, or delegated is retrieved semantically. The longer you use MODUS, the more it knows.",
              },
              {
                title: 'MODUS reaches out first',
                body: "You don't open it to check. It sends the morning briefing, flags what needs you, surfaces what you're ignoring.",
              },
              {
                title: 'Goals, habits, tasks',
                body: 'Set a macro goal in chat. MODUS decomposes it, tracks completion, and recalibrates when you fall behind.',
              },
              {
                title: 'Nothing executes without you',
                body: 'Every action is an approval card. You see exactly what MODUS plans to do. Approve, edit, or skip. No surprises.',
              },
              {
                title: 'Inbox zero as a byproduct',
                body: 'MODUS reads email, categorizes by urgency, drafts responses. You stop opening Gmail to check, it tells you when it needs you.',
              },
            ].map((item, i) => (
              <RevealOnScroll key={item.title} delay={i * 0.07} direction="up">
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 350 }}
                  className="group relative bg-panel rounded-2xl p-6 overflow-hidden cursor-default h-full shadow-lg shadow-black/20"
                >
                  <div className="absolute inset-0 bg-brand/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="relative">
                    <p className="text-sm font-bold text-text mb-2">{item.title}</p>
                    <p className="text-sm text-muted leading-relaxed">{item.body}</p>
                  </div>
                </motion.div>
              </RevealOnScroll>
            ))}
          </div>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <RevealOnScroll className="max-w-2xl mx-auto mb-28">
            <div className="bg-panel rounded-3xl p-8 shadow-xl shadow-black/30">
              <h2 className="text-3xl font-semibold tracking-tight text-text mb-8 text-center">Questions</h2>
              <div>
                {FAQS.map(f => (
                  <FAQItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* ── Final CTA ────────────────────────────────────────────── */}
          <RevealOnScroll direction="none">
            <div className="relative rounded-3xl overflow-hidden bg-panel shadow-2xl shadow-black/40">
              {/* One restrained bloom, matching the homepage closer */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_50%_50%,rgba(124,58,237,0.10),transparent_70%)]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

              <div className="relative text-center py-20 px-8">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-xs font-bold tracking-widest text-brand dark:text-brand-light uppercase mb-6"
                >
                  Start Today
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-4xl md:text-5xl font-semibold text-text mb-5 leading-[1.1] tracking-tight"
                >
                  Ready to run<br />
                  <span className="text-brand dark:text-brand-light">differently?</span>
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
                    className="btn-primary inline-block px-10 py-4 text-white font-bold rounded-2xl text-base transition-all hover:scale-[1.02] active:scale-100"
                  >
                    Start your 3-day trial
                  </Link>
                  <Link
                    href="/features"
                    className="inline-block px-8 py-4 bg-text/[0.06] text-muted hover:bg-text/10 hover:text-text font-semibold rounded-2xl text-sm transition-colors"
                  >
                    See how it works
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
