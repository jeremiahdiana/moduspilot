'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg/80 backdrop-blur-xl border-b border-border/60' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-black tracking-widest text-brand">MODUS</span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted hover:text-text transition-colors">Features</a>
          <a href="/how-it-works" className="text-sm text-muted hover:text-text transition-colors">How It Works</a>
          <a href="/pricing" className="text-sm text-muted hover:text-text transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Sign In
          </a>
          <a
            href="/login"
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors"
          >
            Make Your Modus
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
