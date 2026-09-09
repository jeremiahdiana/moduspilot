'use client';

import { ScrollProgress } from './MarketingBackground';
import RevealSection from './RevealSection';
import MarketingDecor from './MarketingDecor';
import HeroFilm from './HeroFilm';
import HomePricingSection from './HomePricingSection';
import FAQSection from './FAQSection';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

const MODELS = ['Claude', 'GPT-5.6', 'Gemini', 'Llama', 'DeepSeek'];

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

        {/* Quiet "works with every model" strip */}
        <section className="px-6 py-12 border-y border-border">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted mb-6">Every frontier model, one subscription</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {MODELS.map(m => (
                <span key={m} className="text-lg sm:text-xl text-text/70 [font-family:var(--font-serif)]">{m}</span>
              ))}
            </div>
          </div>
        </section>

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
