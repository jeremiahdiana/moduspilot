'use client';

import { motion } from 'framer-motion';
import HeroFilmWindow from './HeroFilmWindow';

/**
 * HeroFilm — the homepage hero, Cluely-style: a serif headline + one-line
 * subtext + a single CTA, sitting ABOVE a contained "app window" that holds the
 * live, looping 1:1 rebuild of the MODUS app (served from /public/hero-film.html
 * in an isolated iframe).
 *
 * The film only renders correctly at its native 1280×720, so we always mount the
 * iframe at that size and CSS-scale the whole element down to whatever width its
 * container ends up (via ResizeObserver). No more full-bleed cover — the film is
 * a floating product shot, not the whole viewport.
 */
export default function HeroFilm() {
  return (
    <section className="relative px-6 pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">
        {/* Headline + subtext + CTA */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-[2.6rem] leading-[1.05] sm:text-6xl md:text-7xl text-text tracking-tight"
        >
          The only AI you&apos;ll
          <br className="hidden sm:block" /> ever pay for
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="mt-6 text-base sm:text-lg text-muted leading-relaxed max-w-xl mx-auto"
        >
          Claude, GPT, Gemini and every other frontier model, plus your whole life connected. One subscription.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="mt-9 flex flex-col items-center gap-3"
        >
          <a
            href="/login"
            className="btn-primary group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-white text-sm font-bold hover:scale-[1.02] active:scale-100 transition-transform"
          >
            Start your 3-day free trial
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
        </motion.div>
      </div>

      {/* Contained hero-film "app window" */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
        className="relative max-w-5xl mx-auto mt-14 sm:mt-20"
      >
        {/* Soft glow behind the window */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(124,58,237,0.16),transparent_70%)]"
        />
        <HeroFilmWindow />
      </motion.div>
    </section>
  );
}
