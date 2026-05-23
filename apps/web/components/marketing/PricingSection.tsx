'use client';

import { motion } from 'framer-motion';

const PLANS = [
  {
    tier: 'FREE',
    price: '$0',
    sub: '30-day full trial, then limited. No credit card required.',
    cta: 'Start Free',
    popular: false,
    features: [
      'AI Chat (limited messages/day)',
      '1 daily briefing',
      'Up to 3 active goals',
      'Basic task capture',
      '7-day context memory',
      'Web + iOS access',
    ],
  },
  {
    tier: 'MODUS',
    price: '$24',
    sub: 'The full operating system. Where MODUS earns its keep.',
    cta: 'Make Your Modus',
    popular: true,
    features: [
      'AI Chat — unlimited, full context',
      'Unlimited briefings + goals + habit engine',
      'Voice interface',
      'Calendar read + write',
      'Gmail / Outlook triage',
      'Habit tracker + streaks',
      'End-of-day reflection',
      '90-day context memory',
      'Weekly review reports',
      'Delegation tracker',
      'Focus protection',
      'Life admin automation',
      'Pattern recognition',
      'Web + iOS + Mac access',
    ],
  },
  {
    tier: 'PILOT',
    price: '$59',
    sub: 'For founders and executives. A fraction of a part-time EA.',
    cta: 'Fly Pilot',
    popular: false,
    features: [
      'Everything in MODUS',
      'Unlimited context memory',
      'Wearable sync (HealthKit, Oura, Whoop)',
      'Financial pulse via Plaid',
      'Relationship intelligence CRM',
      'Meeting intelligence (pre + post)',
      'Travel & logistics management',
      'Document vault',
      'Cross-app execution',
      'Slack + Notion + Linear',
      'Multi-workspace support',
      'Priority response SLA',
    ],
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function PricingSection() {
  return (
    <section id="pricing" className="py-32 px-6 bg-panel/30 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">Your Modus. Your Plan.</h2>
          <p className="text-muted text-lg">Start free. Scale when it earns its keep.</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {PLANS.map(plan => (
            <motion.div
              key={plan.tier}
              variants={item}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`relative bg-panel rounded-2xl overflow-hidden flex flex-col border ${
                plan.popular ? 'border-brand shadow-[0_0_40px_rgba(124,58,237,0.15)]' : 'border-border'
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full">Most Popular</span>
                  </div>
                </>
              )}

              <div className="p-8 border-b border-border">
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">{plan.tier}</p>
                <p className="text-4xl font-black text-text mb-1">
                  {plan.price}<span className="text-base font-normal text-muted">/mo</span>
                </p>
                <p className="text-sm text-muted mt-2">{plan.sub}</p>
              </div>

              <div className="p-8 flex-1">
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                      <span className="text-brand mt-0.5 shrink-0">◆</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-8 pb-8">
                <a
                  href="/login"
                  className={`block w-full py-3.5 rounded-xl text-sm font-bold text-center transition-all ${
                    plan.popular
                      ? 'bg-brand text-white hover:bg-brand/90 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                      : 'border border-border text-muted hover:text-text hover:border-brand/40'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center space-y-2"
        >
          <p className="text-sm text-muted">Annual billing available — 2 months free.</p>
          <p className="text-xs text-muted/60 max-w-lg mx-auto">
            Superhuman charges $30/mo for email alone. A part-time assistant runs $1,500+/mo.
            MODUS at $24 replaces an entire cognitive workflow category.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
