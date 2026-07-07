'use client';

import { motion, useScroll } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand z-[100] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

export function MarketingBackground() {
  // Static ambient violet glows — depth without perpetual drift.
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      <div
        className="absolute rounded-full"
        style={{
          width: '70vw', height: '70vw', top: '-20%', left: '-15%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '60vw', height: '60vw', top: '3%', right: '-14%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 65%)',
          filter: 'blur(72px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '50vw', height: '50vw', bottom: '-8%', left: '-6%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)',
          filter: 'blur(70px)',
        }}
      />
    </div>
  );
}
