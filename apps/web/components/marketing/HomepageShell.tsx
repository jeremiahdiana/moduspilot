'use client';

import { ScrollProgress } from './MarketingBackground';
import RevealSection from './RevealSection';
import MarketingDecor from './MarketingDecor';
import HeroFilm from './HeroFilm';
import MultiModelSection from './MultiModelSection';
import IntegrationsSection from './IntegrationsSection';
import WhyModusSection from './WhyModusSection';
import HomePricingSection from './HomePricingSection';
import FAQSection from './FAQSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

/**
 * HomepageShell — the Cluely-style homepage: a light, serif, radically simplified
 * marketing page. Wrapped in `.marketing-light` so it renders light even though
 * the app force-adds `.dark` globally (see app/globals.css + app/layout.tsx).
 *
 * Six sections: hero → every-model → connect-everything → why-modus → the-math →
 * FAQ → closing CTA. The old dense stack (Chat, CoreLoop, Features, Platforms,
 * Compare, sticky CTA) is intentionally gone — those files still exist but are
 * no longer wired in here.
 */
export default function HomepageShell({ dark = false }: { dark?: boolean }) {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <ScrollProgress />
      <MarketingDecor dark={dark} />

      <div className="relative" style={{ zIndex: 2 }}>
        <HeroFilm />

        <RevealSection>
          <MultiModelSection />
        </RevealSection>

        <RevealSection>
          <IntegrationsSection />
        </RevealSection>

        <RevealSection>
          <WhyModusSection />
        </RevealSection>

        <RevealSection direction="none">
          <HomePricingSection />
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
