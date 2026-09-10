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
      <div className="max-w-5xl mx-auto">
        {/* Headline + subtext + CTA — left-aligned (Anthropic style), not centered */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-[2.8rem] leading-[1.02] sm:text-6xl md:text-7xl text-text tracking-tight max-w-3xl"
        >
          Every model,
          <br className="hidden sm:block" /> one software
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="mt-6 text-base sm:text-lg text-muted leading-relaxed max-w-xl"
        >
          Claude, GPT, Gemini and every other frontier model, plus your whole life connected. One subscription.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <a href="/login" className="btn-ink px-6 py-3 text-sm">
            Start free
          </a>
          <a href="/features" className="btn-outline px-6 py-3 text-sm">
            See how it works
          </a>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-4 text-sm text-muted"
        >
          Free on the open models, no card. Upgrade any time.
        </motion.p>
      </div>

      {/* Contained hero-film "app window" */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
        className="relative max-w-5xl mx-auto mt-14 sm:mt-20"
      >
        <HeroFilmWindow />
      </motion.div>
    </section>
  );
}
