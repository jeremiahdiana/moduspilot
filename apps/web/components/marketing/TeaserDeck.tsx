'use client';

import DeckViewer from './DeckViewer';

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#a78bfa] text-xs font-medium">
      {children}
    </span>
  );
}

/* ─── SLIDE 1 — HOOK ────────────────────────────────────────── */
function Hook() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-3xl mx-auto items-center text-center">
      <div className="flex flex-col gap-6">
        <p className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">
          The AI model wars don&apos;t matter as much as people think.
        </p>
        <p className="font-display text-2xl sm:text-4xl font-black leading-tight">
          Inference prices dropped{' '}
          <span className="text-[#7c3aed]">50× in 2 years.</span>
        </p>
        <p className="font-display text-xl sm:text-3xl font-black text-white/60 leading-tight">
          The winner builds better{' '}
          <span className="text-white">infrastructure</span> — not a better brain.
        </p>
      </div>
      <cite className="text-white/20 text-xs not-italic">Amadeus Capital Research, 2025 · Skywork AI, 2025</cite>
    </div>
  );
}

/* ─── SLIDE 2 — PROBLEM → SOLUTION ─────────────────────────── */
function ProblemSolution() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 items-center text-center">
        <Tag>The Shift</Tag>
        <h2 className="font-display text-3xl sm:text-4xl font-black text-white">From chatbot to operating system.</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-red-500/15 bg-red-500/[0.03]">
          <span className="text-red-400/60 font-semibold text-sm">Every AI chatbot today</span>
          {[
            'Text back and forth',
            'Forgets you every session',
            "Doesn't know your goals",
            "Can't take action",
            'You have to go to it',
          ].map(t => (
            <div key={t} className="flex items-start gap-2 text-white/30 text-sm">
              <span className="text-red-400/40 shrink-0 mt-0.5">✕</span>{t}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.06]">
          <span className="text-[#a78bfa] font-semibold text-sm">MODUS</span>
          {[
            'AI assistant + operating system',
            'Persistent memory of your life',
            'Knows your goals, inbox, calendar, habits',
            'Acts on your behalf — you approve',
            'Comes to you every morning',
          ].map(t => (
            <div key={t} className="flex items-start gap-2 text-white/70 text-sm">
              <span className="text-[#7c3aed] shrink-0 mt-0.5">✓</span>{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SLIDE 3 — PROOF ───────────────────────────────────────── */
function Proof() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 items-center text-center">
        <Tag>Proof</Tag>
        <h2 className="font-display text-3xl sm:text-4xl font-black text-white">Built in 1 week. Real product.</h2>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { v: '7', l: 'Days to build a full AI OS' },
          { v: '10+', l: 'Early users' },
          { v: 'YC', l: 'Applied' },
        ].map(({ v, l }) => (
          <div key={l} className="flex flex-col items-center gap-2 p-5 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 text-center">
            <span className="font-display font-black text-4xl text-[#7c3aed]">{v}</span>
            <span className="text-white/50 text-sm">{l}</span>
          </div>
        ))}
      </div>
      <div className="w-full rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden aspect-video flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-4xl">🖥️</span>
          <span className="text-sm">app.moduspilot.com</span>
          <span className="text-xs">Replace with product screenshot</span>
        </div>
      </div>
    </div>
  );
}

/* ─── SLIDE 4 — THE ASK ─────────────────────────────────────── */
function Ask() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-2xl mx-auto items-center text-center">
      <div className="flex flex-col gap-4 items-center">
        <Tag>Pre-seed Round</Tag>
        <h2 className="font-display text-4xl sm:text-6xl font-black text-white">$500K</h2>
        <p className="text-white/40 text-base">$5M valuation cap · 20% discount · SAFE note</p>
      </div>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#7c3aed]/30 to-transparent" />
      <div className="flex flex-col gap-4 items-center">
        <p className="text-white/60 text-xl font-semibold">Worth 20 minutes?</p>
        <a
          href="mailto:jeremiah@moduspilot.com"
          onClick={e => e.stopPropagation()}
          className="px-8 py-3 rounded-xl bg-[#7c3aed] text-white font-semibold text-lg hover:bg-[#6d28d9] transition-colors"
        >
          jeremiah@moduspilot.com
        </a>
        <a
          href="https://moduspilot.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-white/30 text-sm hover:text-white/50 transition-colors"
        >
          moduspilot.com →
        </a>
      </div>
    </div>
  );
}

const SLIDES = [
  <Hook key="hook" />,
  <ProblemSolution key="ps" />,
  <Proof key="proof" />,
  <Ask key="ask" />,
];

export default function TeaserDeck() {
  return <DeckViewer slides={SLIDES} label="Teaser" />;
}
