'use client';

import { motion, useScroll } from 'framer-motion';
import RevealSection from './RevealSection';
import HeroSection from './HeroSection';
import ChatSection from './ChatSection';
import CoreLoop from './CoreLoop';
import FeaturesSection from './FeaturesSection';
import IntegrationsSection from './IntegrationsSection';
import PricingSection from './PricingSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

/* Thin scroll progress bar */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand z-[100] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

/* Floating ambient orbs — fixed in background, visible on full page scroll */
function AmbientOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {/* Top-left violet */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '65vw', height: '65vw',
          top: '-20%', left: '-15%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
        animate={{ x: [0, 18, -12, 0], y: [0, -14, 18, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Top-right indigo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '55vw', height: '55vw',
          top: '5%', right: '-12%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 65%)',
          filter: 'blur(72px)',
        }}
        animate={{ x: [0, -14, 10, 0], y: [0, 18, -10, 0] }}
        transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      {/* Mid-page center glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '50vw', height: '50vw',
          top: '38%', left: '25%',
          background: 'radial-gradient(circle, rgba(192,132,252,0.13) 0%, transparent 65%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, 20, -8, 0], y: [0, -20, 12, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
      {/* Bottom-left warm purple */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '45vw', height: '45vw',
          bottom: '5%', left: '-8%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 65%)',
          filter: 'blur(64px)',
        }}
        animate={{ x: [0, 16, -12, 0], y: [0, -16, 8, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 9 }}
      />
      {/* Bottom-right */}
      <motion.div
        className="absolute rounded-full dark:opacity-0"
        style={{
          width: '40vw', height: '40vw',
          bottom: '-10%', right: '-5%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, -12, 8, 0], y: [0, 12, -16, 0] }}
        transition={{ duration: 29, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />
    </div>
  );
}

/* Glassy section wrapper — white/frosted in light, subtle dark in dark mode */
function GlassSection({ children, tint = false }: { children: React.ReactNode; tint?: boolean }) {
  return (
    <div className={`relative ${tint
      ? 'bg-white/55 dark:bg-white/[0.03] backdrop-blur-sm border-y border-white/60 dark:border-white/5'
      : ''
    }`}>
      {children}
    </div>
  );
}

/* Section divider */
function Divider() {
  return (
    <div className="flex items-center justify-center py-2 px-6 relative z-10">
      <div className="flex-1 h-px bg-border/40 max-w-xs" />
      <div className="mx-4 w-1.5 h-1.5 rounded-full bg-brand/30" />
      <div className="flex-1 h-px bg-border/40 max-w-xs" />
    </div>
  );
}

export default function HomepageShell() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <ScrollProgress />
      <AmbientOrbs />

      {/* All content sits above the fixed orbs */}
      <div className="relative" style={{ zIndex: 2 }}>
        <HeroSection />

        <Divider />

        {/* Chat demo */}
        <RevealSection>
          <GlassSection>
            <ChatSection />
          </GlassSection>
        </RevealSection>

        {/* How it works */}
        <RevealSection direction="none">
          <GlassSection tint>
            <CoreLoop />
          </GlassSection>
        </RevealSection>

        {/* 4 features */}
        <RevealSection>
          <GlassSection>
            <FeaturesSection />
          </GlassSection>
        </RevealSection>

        <Divider />

        {/* Live integrations */}
        <RevealSection direction="left" distance={24}>
          <GlassSection tint>
            <IntegrationsSection />
          </GlassSection>
        </RevealSection>

        <Divider />

        {/* Pricing */}
        <RevealSection>
          <GlassSection>
            <PricingSection />
          </GlassSection>
        </RevealSection>

        {/* Final CTA */}
        <RevealSection direction="none">
          <FinalCTA />
        </RevealSection>

        <Footer />
      </div>
    </main>
  );
}
