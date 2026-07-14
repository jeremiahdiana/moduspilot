'use client';

import { MarketingBackground, ScrollProgress } from './MarketingBackground';
import RevealSection from './RevealSection';
import HeroSection from './HeroSection';
import ChatSection from './ChatSection';
import MultiModelSection from './MultiModelSection';
import CoreLoop from './CoreLoop';
import FeaturesSection from './FeaturesSection';
import IntegrationsSection from './IntegrationsSection';
import PlatformsSection from './PlatformsSection';
import CompareSection from './CompareSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

function Divider() {
  return (
    <div className="flex items-center justify-center py-2 px-6 relative z-10">
      <div className="flex-1 h-px bg-text/[0.06] max-w-xs" />
      <div className="mx-4 w-1 h-1 rounded-full bg-text/15" />
      <div className="flex-1 h-px bg-text/[0.06] max-w-xs" />
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

        <RevealSection direction="left" distance={24}>
          <MultiModelSection />
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

        <RevealSection>
          <PlatformsSection />
        </RevealSection>

        <Divider />

        <RevealSection direction="none">
          <CompareSection />
        </RevealSection>

        <RevealSection>
          <PricingSection />
        </RevealSection>

        <RevealSection direction="none">
          <FAQSection />
        </RevealSection>

        <RevealSection direction="none">
          <FinalCTA />
        </RevealSection>

        <Footer />
      </div>
    </main>
  );
}
