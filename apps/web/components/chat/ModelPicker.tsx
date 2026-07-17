'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PLATFORM_MODELS, effectivePlan } from '@/lib/models';
import { logoForModel } from '@/components/marketing/ModelLogos';

// Multi-model: the user picks WHICH models answer, rather than MODUS guessing.
// Sits above the composer while multi-model is on, so the chosen set is visible
// at the moment of sending instead of buried in a menu.

export const MAX_PICKED = 3;
export const MIN_PICKED = 2;

export default function ModelPicker({
  open, selected, plan, onToggleModel, onClose,
}: {
  open: boolean;
  selected: string[];
  plan: string;
  onToggleModel: (id: string) => void;
  onClose: () => void;
}) {
  const ep = effectivePlan(plan);
  // Pickable chips first, then the upgrade ladder ($24 tier, then $59) — same rule
  // as ModelSwitcher. In a wrapping chip row a locked chip mid-row reads as a dead
  // button, not a tier. sort() is stable, so the catalog's order survives per rank.
  const models = useMemo(() => {
    const rank = (m: (typeof PLATFORM_MODELS)[number]) =>
      m.plans.includes(ep) ? 0 : m.plans.includes('modus') ? 1 : 2;
    return [...PLATFORM_MODELS].sort((a, b) => rank(a) - rank(b));
  }, [ep]);
  const atMax = selected.length >= MAX_PICKED;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: 6 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: 6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="mb-2 rounded-xl border border-brand/25 bg-panel p-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-text">
                Ask these models
                <span className="ml-1.5 font-normal text-muted tabular-nums">{selected.length}/{MAX_PICKED}</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close model picker"
                className="p-0.5 rounded text-muted hover:text-text transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                  <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {models.map(m => {
                const locked = !m.plans.includes(ep);
                const on = selected.includes(m.id);
                // A locked model can't be picked; an unpicked one is disabled at
                // the cap so the count can't silently exceed MAX_PICKED.
                const disabled = locked || (!on && atMax);
                const Logo = logoForModel(m.id);
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    whileTap={disabled ? undefined : { scale: 0.94 }}
                    onClick={() => !disabled && onToggleModel(m.id)}
                    disabled={disabled}
                    aria-pressed={on}
                    title={locked ? `${m.name} — ${m.plans.includes('modus') ? 'MODUS' : 'PILOT'} plan` : m.name}
                    className={`flex items-center gap-1.5 rounded-lg pl-1.5 pr-2 py-1 text-[11px] font-medium border transition-colors ${
                      on
                        ? 'border-brand/50 bg-brand/15 text-brand'
                        : disabled
                          ? 'border-border/60 text-muted/40 cursor-not-allowed'
                          : 'border-border text-muted hover:text-text hover:border-brand/40'
                    }`}
                  >
                    <Logo className={`w-3.5 h-3.5 ${disabled ? 'opacity-40' : ''}`} />
                    {m.name}
                    {locked ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
                        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    ) : on ? (
                      <motion.svg
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 24 }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                      </motion.svg>
                    ) : null}
                  </motion.button>
                );
              })}
            </div>

            <p className="text-[10px] text-muted/70 mt-2">
              {selected.length < MIN_PICKED
                ? `Pick at least ${MIN_PICKED} to compare.`
                : `Your next message goes to all ${selected.length}, side by side.`}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
