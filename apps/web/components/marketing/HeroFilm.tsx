'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HeroFilm — the homepage hero: a live, looping 1:1 rebuild of the MODUS app
 * served full-bleed from /public/hero-film.html inside an isolated iframe. The
 * film is the whole hero on every viewport — no headline, no CTA.
 *
 * Desktop (lg+): the film COVERS the viewport (the landscape 16:9 app fills a
 * landscape screen edge-to-edge, car-site style).
 *
 * Mobile (<lg): a portrait screen can't cover-crop a landscape film without
 * pushing the app out of frame, so instead the film is scaled to the FULL WIDTH
 * of the screen and centered, so the whole app is visible large and edge-to-edge
 * — the same "the app is the hero" treatment as the laptop. The film only renders
 * correctly at its native size, so we mount the iframe at 1280×720 and CSS-scale
 * the whole element down to the viewport width (via ResizeObserver). The screen
 * above/below the film band is filled with the same aurora so it reads as one
 * cinematic full-screen hero.
 */
export default function HeroFilm() {
  // Mount exactly one film per device: the desktop cover-film only on lg+, the
  // mobile scaled-film only when its band is actually laid out (i.e. on mobile).
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const filmRef = useRef<HTMLDivElement>(null);
  const [filmScale, setFilmScale] = useState(0);
  useEffect(() => {
    const el = filmRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w) setFilmScale(w / 1280);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrim = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060608]/80 via-[#060608]/30 to-transparent"
    />
  );

  return (
    <>
      {/* ── DESKTOP: full-bleed cover film ── */}
      <section className="relative hidden lg:block w-full h-[100svh] overflow-hidden">
        {isDesktop && (
          <iframe
            src="/hero-film.html"
            title="MODUS in action — every frontier model, every task, one place"
            loading="eager"
            scrolling="no"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
        {scrim}
      </section>

      {/* ── MOBILE: full-width film, centered on a full-screen aurora ── */}
      <section className="relative lg:hidden w-full h-[100svh] overflow-hidden bg-[#060608]">
        {/* Aurora backdrop filling the whole screen so the film band is seamless */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_60%_at_50%_42%,rgba(124,58,237,0.22),transparent_70%)]" />
        </div>

        {/* The film, scaled to the full viewport width, vertically centered */}
        <div
          ref={filmRef}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full aspect-video overflow-hidden"
        >
          {filmScale > 0 && (
            <iframe
              src="/hero-film.html"
              title="MODUS in action — every frontier model, every task, one place"
              loading="eager"
              scrolling="no"
              className="absolute top-0 left-0 border-0"
              style={{ width: 1280, height: 720, transformOrigin: 'top left', transform: `scale(${filmScale})` }}
            />
          )}
        </div>

        {scrim}
      </section>
    </>
  );
}
