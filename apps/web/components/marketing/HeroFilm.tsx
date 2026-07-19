'use client';

/**
 * HeroFilm — the homepage hero. A live, looping 1:1 rebuild of the MODUS app
 * (dashboard + multi-model chat), served full-bleed from /public/hero-film.html
 * inside an isolated iframe. The embedded page scales the 16:9 film to COVER the
 * viewport (full-bleed, edge-to-edge, car-site style). The app is centered and the
 * establishing camera shots are zoomed out enough that cover-cropping only eats the
 * ambient aurora, never the app's edges; the caption/progress bar get a title-safe
 * inset. A top scrim keeps the fixed navbar legible over the moving film.
 * No headline, no CTA — the film is the whole hero. WIP; will become a native
 * React component once the animation is locked.
 */
export default function HeroFilm() {
  return (
    <section className="relative w-full h-[100svh] overflow-hidden">
      <iframe
        src="/hero-film.html"
        title="MODUS in action — every frontier model, every task, one place"
        loading="eager"
        scrolling="no"
        className="absolute inset-0 h-full w-full border-0"
      />
      {/* Scrim so the fixed navbar stays legible over the film. Sits above the
          iframe but is click-through; the navbar itself renders above this. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060608]/80 via-[#060608]/30 to-transparent"
      />
    </section>
  );
}
