'use client';

import { MarketingBackground, ScrollProgress } from './MarketingBackground';
import RevealSection from './RevealSection';
import HeroSection from './HeroSection';
import ChatSection from './ChatSection';
import CoreLoop from './CoreLoop';
import FeaturesSection from './FeaturesSection';
import IntegrationsSection from './IntegrationsSection';
import PricingSection from './PricingSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

function Divider() {
  return (
    <div className="flex items-center justify-center py-2 px-6 relative z-10">
      <div className="flex-1 h-px bg-brand/10 max-w-xs" />
      <div className="mx-4 w-1.5 h-1.5 rounded-full bg-brand/25" />
      <div className="flex-1 h-px bg-brand/10 max-w-xs" />
    </div>
  );
}

export default function HomepageShell() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <ScrollProgress />
      <MarketingBackground />

      <div className="relative" style={{ zIndex: 2 }}>
        <HeroSection />

        <Divider />

        <RevealSection>
          <ChatSection />
        </RevealSection>

        <RevealSection direction="none">
          <CoreLoop />
        </RevealSection>

        <RevealSection>
          <FeaturesSection />
        </RevealSection>

        <Divider />

        <RevealSection direction="left" distance={24}>
          <IntegrationsSection />
        </RevealSection>

        <Divider />

        <RevealSection>
          <PricingSection />
        </RevealSection>

        <RevealSection direction="none">
          <FinalCTA />
        </RevealSection>

        <Footer />
      </div>
    </main>
  );
}
