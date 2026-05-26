'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import RevealSection from './RevealSection';
import HeroSection from './HeroSection';
import ChatSection from './ChatSection';
import CoreLoop from './CoreLoop';
import FeaturesSection from './FeaturesSection';
import IntegrationsSection from './IntegrationsSection';
import PricingSection from './PricingSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

/* Scroll progress bar */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand z-[100] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

/* Section divider — subtle line with dot */
function Divider() {
  return (
    <div className="flex items-center justify-center py-2 px-6">
      <div className="flex-1 h-px bg-border/50 max-w-xs" />
      <div className="mx-4 w-1.5 h-1.5 rounded-full bg-brand/30" />
      <div className="flex-1 h-px bg-border/50 max-w-xs" />
    </div>
  );
}

export default function HomepageShell() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden">
      <ScrollProgress />

      {/* Hero — instant, no scroll reveal needed */}
      <HeroSection />

      <Divider />

      {/* Chat demo — the product */}
      <RevealSection>
        <ChatSection />
      </RevealSection>

      {/* How it works — interactive tabs */}
      <RevealSection direction="none">
        <div className="bg-panel/40 dark:bg-panel/20">
          <CoreLoop />
        </div>
      </RevealSection>

      {/* 4 core features */}
      <RevealSection>
        <FeaturesSection />
      </RevealSection>

      <Divider />

      {/* Live integrations */}
      <RevealSection direction="left" distance={24}>
        <IntegrationsSection />
      </RevealSection>

      <Divider />

      {/* Pricing */}
      <RevealSection>
        <div className="bg-panel/40 dark:bg-panel/20">
          <PricingSection />
        </div>
      </RevealSection>

      {/* Final CTA */}
      <RevealSection direction="none">
        <FinalCTA />
      </RevealSection>

      <Footer />
    </main>
  );
}
