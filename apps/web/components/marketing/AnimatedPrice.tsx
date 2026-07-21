'use client';

import { AnimatePresence, motion } from 'framer-motion';

/**
 * A price whose digits roll when the number changes (monthly <-> annual).
 *
 * Each digit is its own AnimatePresence keyed on `position + value`, so only the
 * digits that actually changed animate — $24 -> $20 rolls the 4 to a 0 and
 * leaves the 2 alone, which reads as the number *changing* rather than the whole
 * price being swapped out.
 *
 * `direction` decides which way they roll: up when the price drops (switching to
 * annual), down when it climbs back. Rolling the "cheaper" direction downward
 * feels wrong, so it follows the value.
 */
export default function AnimatedPrice({
  value,
  direction,
  className = '',
}: {
  value: number;
  direction: 'up' | 'down';
  className?: string;
}) {
  const digits = String(value).split('');
  const dy = direction === 'up' ? 1 : -1;

  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`} aria-label={`$${value}`}>
      <span aria-hidden>$</span>
      {digits.map((d, i) => (
        // An invisible in-flow copy of the digit sizes the column and sets the
        // baseline, so the rolling copy lands exactly where a static digit would.
        // Hardcoding a width/height in em instead (the obvious approach) floats
        // the number off the dollar sign, which is visible at 5xl.
        <span key={i} aria-hidden className="relative inline-block overflow-hidden">
          <span className="invisible">{d}</span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`${i}-${d}`}
              initial={{ y: `${dy * 100}%`, opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: `${dy * -100}%`, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
              className="absolute left-0 top-0 w-full text-center"
            >
              {d}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
