'use client';

/**
 * HeroFilm — the homepage hero.
 *
 * Desktop (lg+): a live, looping 1:1 rebuild of the MODUS app served full-bleed
 * from /public/hero-film.html inside an isolated iframe, scaled to COVER the
 * viewport (edge-to-edge, car-site style). The film is the whole hero — no
 * headline, no CTA. This is the beloved desktop hero; leave it untouched.
 *
 * Mobile / narrow (< lg): the landscape 16:9 film cannot cover a tall portrait
 * screen without cropping the app down to an unreadable vertical slice, so we
 * DON'T try. Instead we render a proper composed hero — headline, the multi-model
 * value line, a "Start free trial" CTA and trust bar — so cold mobile traffic
 * gets the value prop and a CTA above the fold. The film still appears, contained
 * inside a 16:9 device card (at 16:9 cover == contain, so the whole app shows and
 * keeps looping) as live product proof beneath the pitch.
 */

/* ── Typewriter (mobile subhead) ── */
import { useEffect, useRef, useState } from 'react';

const PHRASES = ['builds your plan', 'tracks your habits', 'triages your inbox', 'blocks your deep work', 'tells you what to focus on'];
function Typewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [erasing, setErasing] = useState(false);
  useEffect(() => {
    const phrase = PHRASES[idx];
    if (!erasing) {
      if (text.length < phrase.length) { const t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 52); return () => clearTimeout(t); }
      const t = setTimeout(() => setErasing(true), 2000); return () => clearTimeout(t);
    }
    if (text.length > 0) { const t = setTimeout(() => setText(text.slice(0, -1)), 28); return () => clearTimeout(t); }
    setErasing(false); setIdx(i => (i + 1) % PHRASES.length);
  }, [text, erasing, idx]);
  return (
    <span className="text-brand dark:text-brand-light font-semibold whitespace-nowrap">
      {text}<span className="inline-block w-0.5 h-[0.85em] bg-brand ml-0.5 animate-pulse align-middle rounded-full" />
    </span>
  );
}

export default function HeroFilm() {
  // Mount the (heavy) film iframe ONLY on desktop. The section is CSS-gated with
  // `hidden lg:block` so it never shows on mobile, but a display:none iframe still
  // downloads and runs its src — so on the distribution-critical mobile page we
  // avoid loading it at all by gating the iframe on a matchMedia check.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Mobile film card. The film's camera choreography only renders correctly at a
  // large viewport, so we mount the iframe at its native 1280×720 and CSS-scale
  // the whole element down to the card width — the film runs exactly as it does on
  // desktop, just shrunk. filmScale > 0 only when the card is actually visible
  // (mobile), which also keeps the iframe from loading on desktop.
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
    <>
      {/* ── DESKTOP: full-bleed looping film (unchanged) ── */}
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
        {/* Scrim so the fixed navbar stays legible over the film. Click-through;
            the navbar renders above this. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060608]/80 via-[#060608]/30 to-transparent"
        />
      </section>

      {/* ── MOBILE / NARROW: composed hero + contained film card ── */}
      <section className="relative lg:hidden flex flex-col items-center justify-center min-h-[100svh] overflow-hidden px-5 pt-24 pb-14 text-center">
        {/* Local brand glow at the top, over the page's shared background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[130%] h-[70%] bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(124,58,237,0.28),transparent_70%)] blur-2xl" />
        </div>

        <h1 className="fm-rise text-[2.4rem] font-semibold leading-[1.07] tracking-tight mb-5" style={{ animationDelay: '0.05s' }}>
          <span className="text-brand dark:text-brand-light">The Only AI</span><br />
          <span className="text-text">You&apos;ll Ever Need.</span>
        </h1>

        <p className="fm-rise text-base text-muted max-w-md mx-auto mb-4 leading-relaxed" style={{ animationDelay: '0.12s' }}>
          Tell MODUS your goals. It <Typewriter />, every morning. You approve every action.
        </p>

        <p className="fm-rise text-sm text-muted max-w-md mx-auto mb-8 leading-relaxed" style={{ animationDelay: '0.2s' }}>
          Write with <span className="text-text font-semibold">Gemini</span>. Research with <span className="text-text font-semibold">Claude</span>. Ask <span className="text-text font-semibold">ChatGPT</span>. Routed to the best one, automatically.
        </p>

        <div className="fm-rise flex flex-col items-center gap-3 w-full max-w-xs mx-auto mb-6" style={{ animationDelay: '0.28s' }}>
          <a
            href="/login"
            className="btn-primary w-full px-6 py-3.5 bg-brand text-white text-base font-bold rounded-xl transition-all active:scale-[0.98] text-center"
          >
            Start your 3-day free trial
          </a>
          <a href="/features" className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
            See how it works <span aria-hidden>→</span>
          </a>
        </div>

        {/* Trust bar */}
        <div className="fm-rise flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted" style={{ animationDelay: '0.36s' }}>
          {['Every frontier model', 'Gmail & Calendar', 'Web · Mac · iPhone', 'Cancel anytime'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {/* Live product film — mounted at native 1280×720 and CSS-scaled to fit. */}
        <div className="fm-rise w-full max-w-md mx-auto mt-11" style={{ animationDelay: '0.46s' }}>
          <div
            ref={filmRef}
            className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-[#050506] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          >
            {filmScale > 0 && (
              <iframe
                src="/hero-film.html"
                title="MODUS in action — the app, live"
                loading="eager"
                scrolling="no"
                className="absolute top-0 left-0 border-0"
                style={{ width: 1280, height: 720, transformOrigin: 'top left', transform: `scale(${filmScale})` }}
              />
            )}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted/70">A live look at MODUS</p>
        </div>
      </section>
    </>
  );
}
