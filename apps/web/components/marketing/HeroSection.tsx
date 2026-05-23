'use client';

import { motion } from 'framer-motion';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-16">
      {/* Animated ambient background */}
      <div className="absolute inset-0 -z-10">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,transparent_50%,#0a0a0f_100%)]" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Early access badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 text-brand text-xs font-semibold mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Early Access Open — 30 days free, no card needed
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl font-black text-text leading-[1.05] tracking-tight mb-6"
        >
          The AI That
          <br />
          <span className="text-brand">Runs Your Life.</span>
        </motion.h1>

        {/* Subheadline — concrete, specific */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Tell MODUS your goals. It builds the plan, tracks your habits, triages your inbox,
          and tells you exactly what to focus on — every morning. You approve every action.
          Nothing runs without you.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <a
            href="/login"
            className="px-8 py-4 bg-brand text-white text-base font-bold rounded-xl hover:bg-brand/90 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(124,58,237,0.4)] active:scale-100"
          >
            Start free — no credit card needed
          </a>
          <a href="#how-it-works" className="text-sm text-muted hover:text-text transition-colors">
            See how it works ↓
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted/60"
        >
          {['Gmail & Calendar connected', 'Use your own GPT-4o or Claude key', 'Privacy-first — your data stays yours', 'Cancel anytime'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-brand/50">✓</span> {t}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
    </section>
  );
}
