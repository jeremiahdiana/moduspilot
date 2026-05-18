'use client';

import { motion } from 'framer-motion';

const MODUS_POINTS = [
  { label: 'For', value: 'Ambitious people running their own life' },
  { label: 'Core job', value: 'Reduce cognitive load. Automate the admin.' },
  { label: 'Daily shape', value: 'Morning brief, approval queue, habit engine, focus blocks' },
  { label: 'Best for', value: 'Professionals, creators, solopreneurs, students who ship' },
  { label: 'Context window', value: '90-day rolling memory' },
  { label: 'Integrations', value: 'Calendar, Gmail, Habits, Goals, Tasks' },
  { label: 'Voice', value: 'Full voice interface' },
  { label: 'Price', value: '$24/month' },
];

const PILOT_POINTS = [
  { label: 'For', value: 'Founders, CEOs, executives moving at full speed' },
  { label: 'Core job', value: 'A fraction of a human EA at a fraction of the cost.' },
  { label: 'Daily shape', value: 'Everything in MODUS + business intelligence + people ops' },
  { label: 'Best for', value: 'Anyone managing teams, investors, clients, and a personal life' },
  { label: 'Context window', value: 'Unlimited memory' },
  { label: 'Integrations', value: 'Everything + Slack, Notion, Linear, Plaid, Oura, HealthKit' },
  { label: 'Intelligence', value: 'Wearables, financial pulse, relationship CRM, meeting intel' },
  { label: 'Price', value: '$59/month' },
];

export default function ModusVsPilot() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(124,58,237,0.06),transparent)]" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">MODUS or PILOT?</h2>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Both are the same AI engine. The difference is how deep it goes into your world.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MODUS card */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="bg-panel border border-border rounded-2xl overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-border">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">For Everyone</p>
                  <h3 className="text-3xl font-black text-text tracking-wider">MODUS</h3>
                </div>
                <p className="text-2xl font-bold text-brand">$24<span className="text-sm font-normal text-muted">/mo</span></p>
              </div>
            </div>
            <div className="px-8 py-6 space-y-4">
              {MODUS_POINTS.map(pt => (
                <div key={pt.label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">{pt.label}</span>
                  <span className="text-sm text-text">{pt.value}</span>
                </div>
              ))}
              <a
                href="/login"
                className="block w-full mt-6 py-3 border border-brand/40 text-brand text-sm font-semibold rounded-xl text-center hover:bg-brand/10 transition-colors"
              >
                Make Your Modus
              </a>
            </div>
          </motion.div>

          {/* PILOT card */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="bg-panel border border-brand/40 rounded-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
            <div className="px-8 py-6 border-b border-border">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-brand uppercase tracking-widest mb-1">For Executives</p>
                  <h3 className="text-3xl font-black text-text tracking-wider">PILOT</h3>
                </div>
                <p className="text-2xl font-bold text-brand">$59<span className="text-sm font-normal text-muted">/mo</span></p>
              </div>
            </div>
            <div className="px-8 py-6 space-y-4">
              {PILOT_POINTS.map(pt => (
                <div key={pt.label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">{pt.label}</span>
                  <span className="text-sm text-text">{pt.value}</span>
                </div>
              ))}
              <a
                href="/login"
                className="block w-full mt-6 py-3 bg-brand text-white text-sm font-semibold rounded-xl text-center hover:bg-brand/90 transition-colors"
              >
                Fly Pilot
              </a>
            </div>
          </motion.div>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-xs text-muted/60 mt-8"
        >
          Not sure which? Start with MODUS. Upgrade when you need the depth.
        </motion.p>
      </div>
    </section>
  );
}
