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
  return (
    <>
      {/* Fixed ambient orbs — visible through entire page scroll */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        {/* Top-left — primary violet */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '70vw', height: '70vw',
            top: '-20%', left: '-15%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
          animate={{ x: [0, 22, -14, 0], y: [0, -16, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Top-right — indigo */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '60vw', height: '60vw',
            top: '3%', right: '-14%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.16) 0%, transparent 65%)',
            filter: 'blur(72px)',
          }}
          animate={{ x: [0, -16, 12, 0], y: [0, 20, -12, 0] }}
          transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
        {/* Mid center — soft lavender */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '55vw', height: '55vw',
            top: '35%', left: '22%',
            background: 'radial-gradient(circle, rgba(192,132,252,0.13) 0%, transparent 65%)',
            filter: 'blur(80px)',
          }}
          animate={{ x: [0, 24, -10, 0], y: [0, -22, 14, 0] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
        />
        {/* Bottom-left — warm purple */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '50vw', height: '50vw',
            bottom: '5%', left: '-10%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)',
            filter: 'blur(64px)',
          }}
          animate={{ x: [0, 18, -14, 0], y: [0, -18, 10, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
        />
        {/* Bottom-right */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '45vw', height: '45vw',
            bottom: '-8%', right: '-6%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.11) 0%, transparent 65%)',
            filter: 'blur(70px)',
          }}
          animate={{ x: [0, -14, 10, 0], y: [0, 14, -18, 0] }}
          transition={{ duration: 29, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        />
      </div>
    </>
  );
}
