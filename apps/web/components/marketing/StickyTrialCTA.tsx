'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * A floating "start trial" pill that appears once the visitor scrolls past the
 * hero film and hides again near the footer (so it never covers the final CTA).
 * For cold distribution traffic this keeps the trial one tap away at all times.
 */
export default function StickyTrialCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const past = y > window.innerHeight * 0.9;                          // past the hero
      const nearBottom =
        y + window.innerHeight > document.documentElement.scrollHeight - 760; // footer zone
      setShow(past && !nearBottom);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-5 inset-x-4 sm:inset-x-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 flex justify-center"
        >
          <Link
            href="/login"
            className="btn-primary group flex items-center justify-center gap-3 rounded-full w-full sm:w-auto pl-5 pr-4 py-3 text-white shadow-[0_10px_40px_-8px_rgba(124,58,237,0.6)]"
          >
            <span className="text-sm font-bold whitespace-nowrap">Start free, no card</span>
            <span className="hidden sm:inline text-[11px] font-medium text-white/70 whitespace-nowrap border-l border-white/25 pl-3">
              10 messages free · no card
            </span>
            <span className="grid place-items-center w-6 h-6 rounded-full bg-white/20 group-hover:translate-x-0.5 transition-transform">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
