'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PLAN_PRICING, CADENCE_STORAGE_KEY, type Cadence } from '@/lib/pricing';
import AnimatedPrice from './AnimatedPrice';
import CadenceToggle from './CadenceToggle';

type Plan = {
  id: 'modus' | 'pilot';
  name: string;
  tagline: string;
  features: string[];
  popular?: boolean;
  accent: 'violet' | 'white';
};

const PLANS: Plan[] = [
  {
    id: 'modus',
    name: 'MODUS',
    tagline: 'Card required, cancel anytime.',
    popular: true,
    accent: 'violet',
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
    id: 'pilot',
    name: 'PILOT',
    tagline: 'For founders and executives.',
    accent: 'white',
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

const ACCENT = {
  violet: {
    card: 'border-brand/50 shadow-[0_24px_70px_-24px_rgba(124,58,237,0.45)]',
    name: 'text-brand',
    check: 'text-brand',
    badge: 'bg-brand text-white',
    cta: 'btn-primary text-white hover:scale-[1.02] active:scale-100 shadow-[0_0_28px_-4px_rgba(124,58,237,0.55)]',
  },
  white: {
    card: 'pilot-shine',
    name: 'text-brand',
    check: 'text-brand',
    badge: 'bg-white text-brand ring-1 ring-brand/15',
    cta: 'pilot-cta-shine bg-white text-brand ring-1 ring-brand/20 hover:scale-[1.02] active:scale-100',
  },
} as const;

function Check({ accent }: { accent: Plan['accent'] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={`w-4 h-4 shrink-0 mt-0.5 ${ACCENT[accent].check}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * The two plan cards. Shared by the homepage and /pricing so the offer can never
 * drift between them — `showHeading={false}` on /pricing, where the page's own
 * hero already says this.
 */
export default function HomePricingSection({
  showHeading = true,
  showCadenceToggle = false,
}: {
  showHeading?: boolean;
  /** Off on the homepage (kept as signed off); on for /pricing. */
  showCadenceToggle?: boolean;
}) {
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const annual = cadence === 'annual';

  /**
   * Park the choice so it survives /login -> onboarding, where the trial is
   * actually created. The href carries it too, but auth redirects can drop query
   * params, and silently billing monthly after someone picked annual is exactly
   * the class of bug this page just had.
   */
  function chooseCadence(next: Cadence) {
    setCadence(next);
    try { window.localStorage.setItem(CADENCE_STORAGE_KEY, next); } catch { /* private mode */ }
  }

  return (
    // pt-6 even without the heading: the plan badges sit at -top-3 and this
    // section is overflow-hidden, so zero top padding clips them.
    <section id="pricing" className={`${showHeading ? 'py-24 sm:py-28' : 'pt-6 pb-8'} px-6 overflow-hidden`}>
      <div className="max-w-5xl mx-auto">
        {showHeading && (
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
        )}

        {showCadenceToggle && (
          <div className="flex justify-center mb-10">
            <CadenceToggle cadence={cadence} onChange={chooseCadence} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
              className={`relative rounded-2xl p-7 sm:p-8 bg-panel border ${ACCENT[plan.accent].card}`}
            >
              <span className={`absolute -top-3 left-8 rounded-full text-[11px] font-bold px-3 py-1 ${ACCENT[plan.accent].badge}`}>
                {plan.popular ? 'Most popular' : 'Premium'}
              </span>

              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-lg font-black tracking-widest ${ACCENT[plan.accent].name}`}>{plan.name}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <AnimatedPrice
                  value={annual ? PLAN_PRICING[plan.id].annualPerMonth : PLAN_PRICING[plan.id].monthlyPrice}
                  direction={annual ? 'up' : 'down'}
                  // Arbitrary-value font so the rolling digits keep the serif
                  // face the static price used.
                  className="text-5xl text-text [font-family:var(--font-serif)] font-medium"
                />
                <span className="text-muted text-lg">/mo</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-6 min-h-[40px]">
                {annual
                  ? `Billed annually at $${PLAN_PRICING[plan.id].annualTotal}. ${plan.tagline}`
                  : `3 days free, then $${PLAN_PRICING[plan.id].monthlyPrice}/mo. ${plan.tagline}`}
              </p>

              <a
                href={`/login?plan=${plan.id}&cadence=${cadence}`}
                onClick={() => chooseCadence(cadence)}
                className={`group flex items-center justify-center gap-2 w-full rounded-xl px-6 py-3.5 text-sm font-bold transition-all ${ACCENT[plan.accent].cta}`}
              >
                Start 3-day trial
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </a>

              <ul className="mt-7 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check accent={plan.accent} />
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
