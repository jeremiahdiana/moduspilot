'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { MarketingBackground } from '@/components/marketing/MarketingBackground';
import { WindowsLogo } from '@/components/marketing/BrandLogos';

// Version-less filename (artifactName in apps/desktop/electron-builder.yml) so
// this URL keeps resolving to the newest build. Produced by the windows-latest
// GitHub Actions job — Windows installers can't be built on macOS.
const EXE_URL = 'https://github.com/joinFITR/moduspilot/releases/latest/download/MODUS-Desktop-x64.exe';

const STEPS = [
  { n: '1', title: 'Run the installer', body: 'Open MODUS-Desktop-x64.exe from your Downloads.' },
  { n: '2', title: 'Pass the SmartScreen notice', body: 'Windows may say "Windows protected your PC" because the app isn’t signed yet. Click More info, then Run anyway — it’s the same file, just without a paid certificate.' },
  { n: '3', title: 'Open MODUS and sign in', body: 'Use the same account as the web app. Everything syncs across both.' },
];

export default function DownloadWindowsPage() {
  const [started, setStarted] = useState(false);
  const fired = useRef(false);

  const download = () => {
    window.location.href = EXE_URL;
    setStarted(true);
  };

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const t = setTimeout(download, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <MarketingBackground />
      <Navbar solid />

      <div className="relative pt-32 pb-24 px-6" style={{ zIndex: 2 }}>
        <div className="max-w-2xl mx-auto">

          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-brand uppercase">Windows App · Beta</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-brand/70 flex justify-center mb-6"
            >
              <WindowsLogo className="w-11 h-11" />
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
              {started ? 'Check your Downloads folder — it should be there now.' : 'Hang tight, this only takes a second.'}
            </motion.p>

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
                <span className="relative z-10">Download for Windows</span>
              </button>
              <p className="text-xs text-muted/60">MODUS-Desktop-x64.exe · Windows 10 &amp; 11 · 64-bit</p>
            </motion.div>
          </div>

          {/* ── SmartScreen heads-up (honest, not hidden) ─────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4 mb-8"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-5 h-5 shrink-0 text-amber-400 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-text mb-1">Windows may warn you on first run</p>
              <p className="text-sm text-muted leading-relaxed">
                This build isn&rsquo;t code-signed yet, so SmartScreen shows &ldquo;Windows protected your PC.&rdquo; That&rsquo;s expected — click <span className="text-text font-medium">More info</span> then <span className="text-text font-medium">Run anyway</span>. A signed release is on the way.
              </p>
            </div>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex items-center justify-center py-6"
          >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
            <div className="mx-4 w-2 h-2 rounded-full bg-brand/40" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent max-w-md" />
          </motion.div>

          {/* Install steps */}
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

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-center text-sm text-muted"
          >
            On a Mac?{' '}
            <Link href="/download/mac" className="text-brand font-semibold hover:underline">
              Download for Mac →
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
