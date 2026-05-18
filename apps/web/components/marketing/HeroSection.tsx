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
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        {/* Radial fade */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,transparent_50%,#0a0a0f_100%)]" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
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

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          MODUS runs in the background of your life — monitoring, deciding, and surfacing what matters.
          You stay in control. You just don't have to think about everything anymore.
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
            Make Your Modus
          </a>
          <a href="#how-it-works" className="text-sm text-muted hover:text-text transition-colors">
            See how it works ↓
          </a>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
    </section>
  );
}
