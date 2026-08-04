'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { MarketingBackground } from '@/components/marketing/MarketingBackground';
import { AppleLogo } from '@/components/marketing/BrandLogos';

// Version-less filenames (artifactName in apps/desktop/electron-builder.yml), so
// these URLs keep resolving to the newest build without a code change here.
const BASE = 'https://github.com/jeremiahdiana/moduspilot/releases/latest/download';
const BUILDS = {
  arm64: { url: `${BASE}/MODUS-Desktop-arm64.dmg`, label: 'Apple Silicon', sub: 'M1, M2, M3, M4' },
  x64:   { url: `${BASE}/MODUS-Desktop-x64.dmg`,   label: 'Intel',         sub: '2020 or earlier' },
} as const;

type Arch = keyof typeof BUILDS;

// Best-effort chip detection from the GPU renderer string. Apple Silicon reports
// an "Apple" GPU; Intel Macs report Intel/AMD/Radeon. Unknown → we don't guess,
// we let the person choose rather than auto-download a build that won't launch.
function detectArch(): Arch | 'unknown' {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return 'unknown';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (/apple/i.test(renderer)) return 'arm64';
    if (/intel|amd|radeon|nvidia/i.test(renderer)) return 'x64';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

const STEPS = [
  { n: '1', title: 'Open the .dmg', body: 'Find the MODUS Desktop .dmg in your Downloads and double-click it.' },
  { n: '2', title: 'Drag MODUS to Applications', body: 'A window opens with the MODUS icon and an Applications folder. Drag one onto the other.' },
  { n: '3', title: 'Open MODUS and sign in', body: 'Use the same account as the web app. Everything syncs across both.' },
];

export default function DownloadMacPage() {
  const [arch, setArch] = useState<Arch | 'unknown'>('unknown');
  const [started, setStarted] = useState<Arch | null>(null);
  const fired = useRef(false);

  const download = (a: Arch) => {
    window.location.href = BUILDS[a].url;
    setStarted(a);
  };

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const detected = detectArch();
    setArch(detected);
    // Only auto-start when we're confident about the chip — never push an Intel
    // Mac an arm64 build (it simply won't open) or vice versa.
    if (detected !== 'unknown') {
      const t = setTimeout(() => download(detected), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const recommended: Arch | null = arch === 'unknown' ? null : arch;

  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <MarketingBackground />
      <Navbar solid />

      <div className="relative pt-32 pb-24 px-6" style={{ zIndex: 2 }}>
        <div className="max-w-2xl mx-auto">

          {/* ── Status ───────────────────────────────────────────────── */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-brand uppercase">Mac App</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-brand/70 flex justify-center mb-6"
            >
              <AppleLogo className="w-12 h-12" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-5xl md:text-6xl font-black leading-none mb-6"
            >
              {recommended ? (
                <>
                  <span className="text-text">Your download is </span>
                  <span className="hero-gradient-text">starting.</span>
                </>
              ) : (
                <>
                  <span className="text-text">Download </span>
                  <span className="hero-gradient-text">MODUS.</span>
                </>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-muted text-lg leading-relaxed mb-8"
            >
              {started
                ? 'Check your Downloads folder — it should be there now.'
                : recommended
                ? `We detected an ${BUILDS[recommended].label} Mac. Starting your download…`
                : 'Choose the version that matches your Mac.'}
            </motion.p>

            {/* ── Chip picker ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto"
            >
              {(Object.keys(BUILDS) as Arch[]).map((a) => {
                const isRec = recommended === a;
                return (
                  <button
                    key={a}
                    onClick={() => download(a)}
                    className={`relative flex flex-col items-center gap-1 px-5 py-4 rounded-2xl border transition-all ${
                      isRec
                        ? 'btn-primary text-white border-transparent'
                        : 'bg-panel/60 border-border/70 hover:border-brand/40 text-text'
                    }`}
                  >
                    {isRec && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand text-white shadow">
                        Recommended
                      </span>
                    )}
                    <span className="relative z-10 text-sm font-bold">{BUILDS[a].label}</span>
                    <span className={`relative z-10 text-[11px] ${isRec ? 'text-white/70' : 'text-muted'}`}>{BUILDS[a].sub}</span>
                  </button>
                );
              })}
            </motion.div>
            <p className="text-xs text-muted/60 mt-4">
              Not sure?{' '}
              <span className="text-muted">Apple menu → About This Mac</span> shows your chip. Most Macs from 2020 on are Apple Silicon.
            </p>
          </div>

          {/* Decorative divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex items-center justify-center py-8"
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
            <div className="mx-4 w-2 h-2 rounded-full bg-brand/40" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
          </motion.div>

          {/* ── Install steps ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-panel/60 backdrop-blur-xl border border-border/70 rounded-3xl p-8 mb-8 shadow-xl shadow-brand/5"
          >
            <p className="text-xs font-bold tracking-widest text-muted uppercase mb-8 text-center">Installing</p>
            <div className="space-y-6">
              {STEPS.map(s => (
                <div key={s.n} className="flex items-start gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-brand/15 border border-brand/40 text-brand text-sm font-bold flex items-center justify-center">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-text mb-1">{s.title}</p>
                    <p className="text-sm text-muted leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Reassurance ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted mb-10"
          >
            {['Signed & notarized by Apple', 'Updates itself automatically', 'Intel & Apple Silicon'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="text-brand">◆</span>
                {t}
              </span>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-center text-sm text-muted"
          >
            On Windows?{' '}
            <Link href="/download/windows" className="text-brand font-semibold hover:underline">
              Download for Windows →
            </Link>
            {'  ·  '}
            <Link href="https://app.moduspilot.com" className="text-brand font-semibold hover:underline">
              Use the web app
            </Link>
          </motion.p>

        </div>
      </div>
    </main>
  );
}
