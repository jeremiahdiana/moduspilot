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
  // Neutral depth only. Color is reserved for interactive elements.
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      <div
        className="absolute rounded-full"
        style={{
          width: '70vw', height: '70vw', top: '-20%', left: '-15%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.022) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '50vw', height: '50vw', bottom: '-8%', left: '-6%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.016) 0%, transparent 65%)',
          filter: 'blur(70px)',
        }}
      />
    </div>
  );
}
