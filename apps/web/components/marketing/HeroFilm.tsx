'use client';

import HeroFilmWindow from './HeroFilmWindow';

/**
 * HeroFilm — the homepage hero. Anthropic-style two-column: a big serif headline on
 * the left, a confident supporting paragraph on the right (so the right side isn't
 * empty), CTAs below. Static — no entrance animation. Below sits the contained
 * "app window" that loops the live product film (the one animation we keep).
 */
export default function HeroFilm() {
  return (
    <section className="relative px-6 pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-6 md:items-end">
          <h1 className="text-[2.8rem] leading-[1.02] sm:text-6xl md:text-7xl text-text tracking-tight">
            Every model,
            <br className="hidden sm:block" /> one software
          </h1>
          <p className="text-lg sm:text-xl text-muted leading-relaxed md:pb-3">
            The AI apps you pay for each know only their maker&apos;s model, and forget you the moment you
            close the tab. MODUS puts every frontier model in one place, connected to your inbox, calendar and
            files.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href="/login" className="btn-ink px-6 py-3 text-sm">
            Start free
          </a>
          <a href="/features" className="btn-outline px-6 py-3 text-sm">
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-muted">Free on the open models, no card. Upgrade any time.</p>
      </div>

      {/* Contained hero-film "app window" — the one animation we keep */}
      <div className="relative max-w-5xl mx-auto mt-14 sm:mt-20">
        <HeroFilmWindow />
      </div>
    </section>
  );
}
