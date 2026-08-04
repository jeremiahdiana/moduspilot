'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import HomePricingSection from '@/components/marketing/HomePricingSection';
import MarketingDecor from '@/components/marketing/MarketingDecor';

/**
 * /pricing — rebuilt 2026-07-21 to match the light/serif homepage.
 *
 * Deliberately thin: a hero, the SAME two plan cards the homepage renders
 * (imported, not copied, so the offer can never drift), one honest cost line,
 * the questions, one CTA. The old page had a 4-tile comparison grid, a
 * 6-card "what you actually get" grid, a Group card and 7 FAQs on a dark theme.
 *
 * Two factual bugs removed with it:
 *  - "Annual billing available, 2 months free" — no annual price existed in
 *    Stripe at the time, and this page's own FAQ said so two sections earlier.
 *    Annual is real now and the toggle sells it.
 *  - "See how it works" linked to /features, which now redirects to /.
 *
 * Group is gone entirely (2026-08-04) — multi-seat moves to its own Enterprise
 * section rather than sitting as a third tier here. Two plans, plus the limits
 * add-on for anyone who needs headroom without the jump to PILOT.
 */

const FAQS = [
  {
    q: 'What happens after the 3-day trial?',
    a: 'Your card is billed for the plan you chose, $24/mo for MODUS or $59/mo for PILOT, and you keep full access. We tell you before the trial ends, and you can cancel any time in those 3 days at no charge.',
  },
  {
    q: 'Can I cancel anytime?',
    // ⚠️ COPY IS NOW SLIGHTLY UNDER-STATED, deliberately left for Jeremiah to
    // decide. This said "there is no free tier", which stopped being true on
    // 2026-08-04. The webhook still sets plan:'free' and hasActiveAccess() still
    // rejects it — but enforceSubscriptionGate now lets such an account send any
    // unspent free messages, so "MODUS stops" is true only for someone who
    // already used all ten. Nothing being deleted is still the part worth saying.
    a: 'Yes, no lock-in. Cancel from Settings, Billing and you keep full access until the end of the billing period. After that MODUS stops until you resubscribe. Nothing is deleted, and your goals, notes and history are exactly where you left them.',
  },
  {
    q: 'Is there annual billing?',
    // True as of 2026-07-21: price_1TvWQu... ($240) and price_1TvWR0... ($588)
    // are live in Stripe and wired through /api/stripe/checkout via `cadence`.
    // The limits add-on is monthly-only, which is why it isn't mentioned here.
    a: 'Yes. Switch the toggle above to Annually and you get 2 months free: MODUS is $240 a year, which works out at $20/mo, and PILOT is $588 a year, $49/mo. Same 3-day trial either way, and you can still cancel before it ends.',
  },
  {
    q: 'What if I hit my limits?',
    // Deliberately does NOT quote a single message count. One add-on is +500k
    // units/day, which is ~25 more messages on standard models but under one
    // more on Claude Fable 5 — a bare "25 more messages" would be false for
    // anyone using the frontier tier. "Double" is exact for every model.
    a: 'Add extra limits for $10/mo and your daily and weekly ceilings double. You can stack it as many times as you need, and cancel it separately without touching your plan. It works out cheaper than moving to PILOT if all you want is more usage rather than the frontier models.',
  },
  {
    q: "What's the difference between MODUS and PILOT?",
    a: 'MODUS gives you every provider on Auto, routed to whichever model fits the task. PILOT adds the frontier tier, Claude Opus, Claude Fable 5, GPT-5.6 Sol and Gemini 3.1 Pro, which you pick per message, plus the executive layer: wearable sync, financial pulse, relationship CRM, meeting intelligence and a document vault.',
  },
  {
    q: 'Is my data private?',
    a: 'Your data is never sold or used to train AI models. Conversations, goals and memories are stored in your own database, MODUS reads your connected apps only to surface what matters, and it never sends or publishes anything without your explicit approval.',
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
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-panel hover:bg-panel/80 transition-colors"
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
            <p className="px-6 py-4 text-sm text-muted leading-relaxed bg-bg/60">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PricingPage() {
  // Same light-by-default marketing shell the homepage uses (see MarketingHome).
  const [dark, setDark] = useState(false);

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={() => setDark(d => !d)} />

      <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
        <MarketingDecor dark={dark} />

        <div className="relative" style={{ zIndex: 2 }}>
          {/* ── Hero ──────────────────────────────────────────────────── */}
          <section className="pt-36 pb-14 px-6 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5"
            >
              One subscription.
              <br />
              Every model.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
              className="text-muted text-lg max-w-xl mx-auto leading-relaxed"
            >
              3 days free, card required, cancel anytime.
            </motion.p>
          </section>

          {/* ── The two plans (shared with the homepage) ───────────────── */}
          <HomePricingSection showHeading={false} showCadenceToggle />

          {/* ── The honest cost line ──────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="px-6 pt-6 pb-24"
          >
            <p className="max-w-xl mx-auto text-center text-sm text-muted leading-relaxed">
              ChatGPT Plus, Claude Pro, Google AI Pro, Perplexity Pro and Midjourney come to{' '}
              <span className="text-text font-semibold">$110 a month</span>, and none of them know your
              calendar, your inbox, or what you decided last week.
            </p>
          </motion.section>

          {/* ── Questions ─────────────────────────────────────────────── */}
          <section className="px-6 pb-28">
            <div className="max-w-2xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-3xl md:text-4xl text-text tracking-tight text-center mb-10"
              >
                Questions
              </motion.h2>

              <div className="space-y-3">
                {FAQS.map((faq, i) => (
                  <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
                ))}
              </div>
            </div>
          </section>

          {/* ── Final CTA ─────────────────────────────────────────────── */}
          <section className="px-6 pb-32 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl text-text tracking-tight mb-6"
            >
              Start today.
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Link
                href="/login"
                className="btn-primary inline-flex items-center gap-2 px-9 py-4 text-white font-bold rounded-xl text-base transition-all hover:scale-[1.02] active:scale-100"
              >
                Start your 3-day trial
                <span>→</span>
              </Link>
              <p className="text-muted text-xs mt-5">3 days free · card required · cancel anytime</p>
            </motion.div>
          </section>

          <Footer />
        </div>
      </main>
    </div>
  );
}
