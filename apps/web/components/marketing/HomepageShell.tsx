'use client';

import { ScrollProgress } from './MarketingBackground';
import RevealSection from './RevealSection';
import MarketingDecor from './MarketingDecor';
import HeroFilm from './HeroFilm';
import LatestReleaseCard from './LatestReleaseCard';
import HomeSections from './HomeSections';
import HomePricingSection from './HomePricingSection';
import FAQSection from './FAQSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

/**
 * HomepageShell — the simplified homepage (Anthropic / Perplexity reference): a
 * short scroll of hero, a quiet "every model" strip, pricing, FAQ and the closing
 * CTA. The dense feature sections (multi-model, integrations, why-modus) now live
 * on their own Product pages so the homepage stays calm.
 */
export default function HomepageShell({ dark = false }: { dark?: boolean }) {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden relative">
      <ScrollProgress />
      <MarketingDecor dark={dark} />

      <div className="relative" style={{ zIndex: 2 }}>
        <HeroFilm />

        {/* Anthropic-style latest-release image card */}
        <section className="max-w-6xl mx-auto px-6 pb-4">
          <LatestReleaseCard
            eyebrow="Every frontier model"
            title={<>Claude, GPT-5.6, Gemini<br className="hidden sm:block" /> and every model, in one place</>}
            subtitle="One subscription instead of five. Auto-routed to the best model for every task."
            image="/marketing/sky.jpg"
            href="/product/compare"
            cta="See the models"
          />
        </section>

        <HomeSections />

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
