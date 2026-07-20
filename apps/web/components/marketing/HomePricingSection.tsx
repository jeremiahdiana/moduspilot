'use client';

import { motion } from 'framer-motion';

type Plan = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    name: 'MODUS',
    price: '$24',
    cadence: '/mo',
    blurb: '3 days free, then $24/mo. Card required, cancel anytime.',
    popular: true,
    features: [
      'AI Chat, unlimited with full context',
      'Every provider, auto-routed: GPT-5.6, Claude, Gemini, Llama',
      'Generate images & editable PDFs',
      'Unlimited briefings',
      'Unlimited goals + habit engine',
      'Voice interface',
      'Calendar integration (read + write)',
      'Gmail / Outlook triage',
      'Habit tracker + streaks',
      'End-of-day reflection',
      '90-day context memory',
      'Weekly review reports',
      'Delegation tracker',
      'Focus protection',
      'Life admin automation',
      'Pattern recognition',
      'Web + Mac apps live, iPhone in beta',
    ],
  },
  {
    name: 'PILOT',
    price: '$59',
    cadence: '/mo',
    blurb: 'For founders and executives. 3 days free, then $59/mo.',
    features: [
      'Everything in MODUS',
      'The frontier models (GPT-5.6 Sol, Claude Opus, Claude Fable 5 and Gemini 3.1 Pro), manual pick per message',
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

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="w-4 h-4 text-brand shrink-0 mt-0.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function HomePricingSection() {
  return (
    <section id="pricing" className="py-24 sm:py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl text-text tracking-tight mb-4">Simple, honest pricing</h2>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto">
            One subscription instead of five. 3 days free, cancel anytime.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
              className={`relative rounded-2xl p-7 sm:p-8 bg-panel border ${
                plan.popular ? 'border-brand/50 shadow-[0_24px_60px_-24px_rgba(124,58,237,0.35)]' : 'border-border'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-8 rounded-full bg-brand text-white text-[11px] font-bold px-3 py-1">
                  Most popular
                </span>
              )}

              <div className="flex items-baseline justify-between mb-1">
                <span className="text-lg font-black tracking-widest text-brand">{plan.name}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl text-text" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{plan.price}</span>
                <span className="text-muted text-lg">{plan.cadence}</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-6 min-h-[40px]">{plan.blurb}</p>

              <a
                href="/login"
                className={`group flex items-center justify-center gap-2 w-full rounded-xl px-6 py-3.5 text-sm font-bold transition-all ${
                  plan.popular
                    ? 'btn-primary text-white hover:scale-[1.02] active:scale-100'
                    : 'border border-border text-text hover:bg-text/[0.04]'
                }`}
              >
                Start 3-day trial
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </a>

              <ul className="mt-7 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-sm text-text/90 leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
