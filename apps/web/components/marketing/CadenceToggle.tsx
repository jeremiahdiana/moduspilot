'use client';

import { motion } from 'framer-motion';
import { MONTHS_FREE, type Cadence } from '@/lib/pricing';

/**
 * Monthly / Annually switch. The active pill is a shared layoutId so it slides
 * between the two labels instead of blinking.
 */
export default function CadenceToggle({
  cadence,
  onChange,
}: {
  cadence: Cadence;
  onChange: (c: Cadence) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="relative inline-flex items-center rounded-full bg-text/[0.06] p-1"
      >
        {(['monthly', 'annual'] as Cadence[]).map(c => {
          const active = cadence === c;
          return (
            <button
              key={c}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c)}
              className={`relative z-10 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                active ? 'text-white' : 'text-muted hover:text-text'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="cadence-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-full bg-brand"
                />
              )}
              {c === 'monthly' ? 'Monthly' : 'Annually'}
            </button>
          );
        })}
      </div>

      <motion.p
        initial={false}
        animate={{ opacity: cadence === 'annual' ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="text-xs font-semibold text-brand h-4"
      >
        {MONTHS_FREE} months free
      </motion.p>
    </div>
  );
}
