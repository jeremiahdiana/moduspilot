'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The contained "app window" that holds the live, looping 1:1 rebuild of the
 * MODUS app (served from /public/hero-film.html in an isolated iframe).
 *
 * The film only renders correctly at its native 1280×720, so we always mount the
 * iframe at that size and CSS-scale the whole element down to whatever width its
 * container ends up (via ResizeObserver).
 *
 * Extracted from HeroFilm so the homepage hero and the founding journey show the
 * SAME product shot — the founding page used to ship a static screenshot, which
 * drifts out of date the moment the app changes.
 */
export default function HeroFilmWindow({ className = '' }: { className?: string }) {
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

  return (
    <div
      ref={filmRef}
      className={`relative w-full aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-[0_30px_80px_-20px_rgba(30,20,60,0.35)] ring-1 ring-black/5 ${className}`}
    >
      {filmScale > 0 && (
        <iframe
          src="/hero-film.html"
          title="MODUS in action: every frontier model, every task, one place"
          loading="eager"
          scrolling="no"
          className="absolute top-0 left-0 border-0"
          style={{ width: 1280, height: 720, transformOrigin: 'top left', transform: `scale(${filmScale})` }}
        />
      )}
    </div>
  );
}
