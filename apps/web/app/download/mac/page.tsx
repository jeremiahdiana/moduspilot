'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { MarketingBackground } from '@/components/marketing/MarketingBackground';
import { AppleLogo } from '@/components/marketing/BrandLogos';

// Version-less filename, set via artifactName in apps/desktop/electron-builder.yml,
// so this URL keeps resolving to the newest build without a code change here.
const DMG_URL = 'https://github.com/joinFITR/moduspilot/releases/latest/download/MODUS-Desktop-arm64.dmg';

const STEPS = [
  { n: '1', title: 'Open the .dmg', body: 'Find MODUS-Desktop-arm64.dmg in your Downloads and double-click it.' },
  { n: '2', title: 'Drag MODUS to Applications', body: 'A window opens with the MODUS icon and an Applications folder. Drag one onto the other.' },
  { n: '3', title: 'Open MODUS and sign in', body: 'Use the same account as the web app. Everything syncs across both.' },
];

export default function DownloadMacPage() {
  const [started, setStarted] = useState(false);
  const fired = useRef(false);

  const download = () => {
    window.location.href = DMG_URL;
    setStarted(true);
  };

  useEffect(() => {
    // Guard against React's double-invoked effects in dev, which would
    // otherwise kick off the download twice.
    if (fired.current) return;
    fired.current = true;

    const t = setTimeout(download, 700);
    return () => clearTimeout(t);
  }, []);

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
              <span className="text-text">Your download is </span>
              <span className="hero-gradient-text">starting.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-muted text-lg leading-relaxed mb-8"
            >
              {started
                ? 'Check your Downloads folder — it should be there now.'
                : 'Hang tight, this only takes a second.'}
            </motion.p>

            {/* ── Manual fallback ────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="text-sm text-muted">Didn&rsquo;t start automatically?</p>
              <button
                onClick={download}
                className="btn-primary inline-block px-10 py-4 text-white font-bold rounded-2xl text-base"
              >
                Download for Mac
              </button>
              <p className="text-xs text-muted/60">
                MODUS-Desktop-arm64.dmg · 136 MB · Apple Silicon (M1 or later)
              </p>
            </motion.div>
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
            {['Signed & notarized by Apple', 'Updates itself automatically', 'Requires an Apple Silicon Mac'].map(t => (
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
            Not on a Mac?{' '}
            <Link href="https://app.moduspilot.com" className="text-brand font-semibold hover:underline">
              Use the web app instead →
            </Link>
          </motion.p>

        </div>
      </div>
    </main>
  );
}
