'use client';

import Image from 'next/image';
import type { User } from 'firebase/auth';
import FoundingCard from './FoundingCard';
import FoundingAuth from './FoundingAuth';
import {
  FRONTIER_MODELS, PRICE_TEARDOWN, TEARDOWN_TOTAL, FOUNDING_PRICE,
  JOURNEY_PERKS, DAY_STEPS,
} from './foundingContent';

// Each scene is a full-bleed centered composition. They remount as the journey
// advances, so the `fm-rise` staggered entrances replay every time.

export interface SceneProps {
  label: string;
  foundingNumber: number;
  cap: number;
  claimed: number;
  // final scene only:
  authed?: boolean;
  onAuthed?: (u: User) => void;
  onClaim?: () => void;
  claiming?: boolean;
  claimError?: string;
}

function rise(delay: number) {
  return { className: 'fm-rise', style: { animationDelay: `${delay}s` } as React.CSSProperties };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] tracking-[0.4em] uppercase text-violet-300/90">{children}</p>;
}

function DeviceShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="fj-device w-full max-w-[540px] aspect-[16/10] mx-auto float">
      <Image src={src} alt={alt} fill sizes="540px" className="object-cover object-top" priority />
    </div>
  );
}

/* 1 ── Opening: what MODUS is */
export function SceneOpening({}: SceneProps) {
  return (
    <div className="w-full max-w-3xl text-center flex flex-col items-center">
      <div {...rise(0.1)}><Eyebrow>Welcome to MODUS</Eyebrow></div>
      <h1 {...rise(0.25)} className="fm-rise text-4xl sm:text-6xl font-semibold tracking-tight text-text text-balance mt-5 leading-[1.05]">
        The only AI<br />you’ll ever need.
      </h1>
      <p {...rise(0.45)} className="fm-rise text-base text-muted mt-5 max-w-lg leading-relaxed">
        MODUS is the AI operating system that runs your day — every frontier model in one place, plus an assistant that actually acts, not just answers.
      </p>
      <div {...rise(0.7)} className="fm-rise mt-10 w-full">
        <DeviceShot src="/screenshot-home.png" alt="MODUS home" />
      </div>
    </div>
  );
}

/* 2 ── Every frontier model + verified price teardown */
export function SceneModels({}: SceneProps) {
  return (
    <div className="w-full max-w-4xl text-center flex flex-col items-center">
      <div {...rise(0.1)}><Eyebrow>One subscription · every lab</Eyebrow></div>
      <h2 {...rise(0.22)} className="fm-rise text-3xl sm:text-5xl font-semibold tracking-tight text-text text-balance mt-4">
        The best model from every frontier lab.
      </h2>
      <p {...rise(0.34)} className="fm-rise text-sm text-muted mt-3 max-w-xl leading-relaxed">
        Pick one, or leave it on <span className="text-text font-medium">Auto</span> and MODUS routes each task to whichever model does it best.
      </p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full">
        {FRONTIER_MODELS.map((m, i) => (
          <div key={m.name} {...rise(0.42 + i * 0.08)}
            className="fm-rise fm-chip rounded-2xl p-3 flex flex-col items-center text-center gap-1.5">
            <span className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center"><m.logo className="w-4 h-4" /></span>
            <p className="text-[13px] font-semibold text-text leading-tight">{m.name}</p>
            <p className="text-[10px] text-muted leading-snug">{m.blurb}</p>
          </div>
        ))}
      </div>

      {/* price teardown */}
      <div {...rise(0.9)} className="fm-rise mt-6 w-full max-w-md rounded-2xl border border-border/60 bg-panel/50 backdrop-blur-md p-4">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Buy the flagship tier yourself</p>
        <div className="space-y-2">
          {PRICE_TEARDOWN.map(r => (
            <div key={r.lab} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text"><r.logo className="w-4 h-4" /> {r.lab} · {r.tier}</span>
              <span className="tabular-nums text-muted">${r.price}/mo</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <span className="text-sm text-muted">Total</span>
          <span className="fj-strike text-lg font-semibold text-text tabular-nums" style={{ ['--d' as string]: '1.2s' }}>~${TEARDOWN_TOTAL}/mo</span>
        </div>
        <div className="mt-4 flex items-end justify-center gap-2">
          <span className="fm-foil-text fm-emboss text-5xl font-black leading-none">${FOUNDING_PRICE}</span>
          <span className="text-sm text-muted pb-1">/mo · locked for life</span>
        </div>
        <p className="text-[11px] text-muted/60 mt-2">Flagship consumer tiers, 2026. Llama 4 Maverick is open-weight — included free.</p>
      </div>
    </div>
  );
}

/* 3 ── It runs your day */
export function SceneDay({}: SceneProps) {
  return (
    <div className="w-full max-w-4xl">
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div className="order-2 md:order-1 text-center md:text-left">
          <div {...rise(0.1)}><Eyebrow>Not another chatbot</Eyebrow></div>
          <h2 {...rise(0.22)} className="fm-rise text-3xl sm:text-4xl font-semibold tracking-tight text-text text-balance mt-4">
            It runs your day.
          </h2>
          <div className="mt-6 space-y-4">
            {DAY_STEPS.map(([t, d], i) => (
              <div key={t} {...rise(0.36 + i * 0.12)} className="fm-rise flex gap-3.5">
                <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-brand/20 ring-1 ring-brand/30 text-brand text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-text">{t}</p>
                  <p className="text-xs text-muted leading-snug">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <p {...rise(0.75)} className="fm-rise text-xs text-muted/70 mt-6">Goals · habits · inbox · calendar — connected, and nothing runs without your yes.</p>
        </div>
        <div {...rise(0.4)} className="fm-rise order-1 md:order-2">
          <DeviceShot src="/screenshot-briefing.png" alt="MODUS daily briefing" />
        </div>
      </div>
    </div>
  );
}

/* 4 ── Your founding advantage */
export function SceneAdvantage({ label, foundingNumber, cap }: SceneProps) {
  return (
    <div className="w-full max-w-4xl">
      <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-10 md:gap-14 items-center">
        <div {...rise(0.2)} className="fm-rise flex justify-center md:justify-start">
          <FoundingCard label={label} foundingNumber={foundingNumber} cap={cap} />
        </div>
        <div>
          <div {...rise(0.1)}><Eyebrow>Founding Member No. {String(foundingNumber).padStart(3, '0')}</Eyebrow></div>
          <h2 {...rise(0.24)} className="fm-rise text-3xl sm:text-4xl font-semibold tracking-tight text-text text-balance mt-3">
            Your founding advantage.
          </h2>
          <ul className="mt-6 space-y-3">
            {JOURNEY_PERKS.map(([t, d], i) => (
              <li key={t} {...rise(0.36 + i * 0.09)} className="fm-rise flex gap-3">
                <span className="mt-0.5 inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-full bg-brand/20 text-brand ring-1 ring-brand/30">
                  <svg viewBox="0 0 20 20" className="w-2.5 h-2.5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3.3-3.3a1 1 0 1 1 1.4-1.4l2.6 2.6 6.3-6.3a1 1 0 0 1 1.4 0Z" /></svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-text leading-snug">{t}</p>
                  <p className="text-xs text-muted leading-snug">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* 5 ── Claim: branded sign-in → confirm → pay */
export function SceneClaim({ label, foundingNumber, authed, onAuthed, onClaim, claiming, claimError }: SceneProps) {
  return (
    <div className="w-full max-w-md text-center flex flex-col items-center">
      <div {...rise(0.1)}><Eyebrow>The last step</Eyebrow></div>
      <h2 {...rise(0.22)} className="fm-rise text-3xl sm:text-4xl font-semibold tracking-tight text-text text-balance mt-3">
        Claim your seat{label ? `, ${label}` : ''}.
      </h2>
      <p {...rise(0.32)} className="fm-rise text-sm text-muted mt-3">
        Founding Member No. {String(foundingNumber).padStart(3, '0')} — full PILOT, <span className="text-text font-medium">${FOUNDING_PRICE}/mo locked for life</span>.
      </p>

      <div {...rise(0.44)} className="fm-rise w-full mt-7">
        {authed ? (
          <>
            <button onClick={onClaim} disabled={claiming}
              className="btn-primary w-full py-4 rounded-xl text-white text-sm font-semibold disabled:opacity-60">
              <span className="relative z-10">{claiming ? 'Opening secure checkout…' : `Claim my seat — $${FOUNDING_PRICE}/mo, billed today`}</span>
            </button>
            {claimError && <p className="text-red-400 text-xs mt-3">{claimError}</p>}
            <p className="text-[11px] text-muted/60 mt-3">Secure checkout by Stripe · cancel anytime</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted mb-4">Create your founding account to continue — 10 seconds.</p>
            {onAuthed && <FoundingAuth onAuthed={onAuthed} />}
          </>
        )}
      </div>
    </div>
  );
}

export const SCENES = [SceneOpening, SceneModels, SceneDay, SceneAdvantage, SceneClaim];
