'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import RevealSection from './RevealSection';
import HeroSection from './HeroSection';
import ChatSection from './ChatSection';
import CoreLoop from './CoreLoop';
import QuoteSection from './QuoteSection';
import FeaturesSection from './FeaturesSection';
import DayInLife from './DayInLife';
import PlatformsSection from './PlatformsSection';
import CompareSection from './CompareSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

/* Ambient background orbs that drift slowly as you scroll */
function ScrollOrbs() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '-30%']);
  const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity1 = useTransform(scrollYProgress, [0, 0.3, 0.6, 1], [0.6, 0.4, 0.3, 0.15]);
  const opacity2 = useTransform(scrollYProgress, [0, 0.2, 0.5, 1], [0.3, 0.5, 0.4, 0.2]);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <motion.div
        style={{ y: y1, opacity: opacity1 }}
        className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full"
        animate={{
          background: [
            'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{ y: y2, opacity: opacity2 }}
        className="absolute -bottom-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full"
        animate={{
          background: [
            'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

/* Thin progress bar at top of page */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand z-[100] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

export default function HomepageShell() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden">
      <ScrollProgress />
      <ScrollOrbs />

      {/* Hero — no delay, instant entrance */}
      <HeroSection />

      {/* Every section below gets a scroll-triggered reveal */}
      <RevealSection delay={0}>
        <ChatSection />
      </RevealSection>

      <RevealSection delay={0} direction="left" distance={24}>
        <CoreLoop />
      </RevealSection>

      <RevealSection delay={0} direction="none">
        <QuoteSection />
      </RevealSection>

      <RevealSection delay={0}>
        <FeaturesSection />
      </RevealSection>

      <RevealSection delay={0} direction="right" distance={24}>
        <DayInLife />
      </RevealSection>

      <RevealSection delay={0}>
        <PlatformsSection />
      </RevealSection>

      <RevealSection delay={0} direction="left" distance={20}>
        <CompareSection />
      </RevealSection>

      <RevealSection delay={0}>
        <PricingSection />
      </RevealSection>

      <RevealSection delay={0} direction="up" distance={20}>
        <FAQSection />
      </RevealSection>

      <RevealSection delay={0} direction="none">
        <FinalCTA />
      </RevealSection>

      <Footer />
    </main>
  );
}
