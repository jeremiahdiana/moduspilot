import type { Metadata } from 'next';
import Navbar from '@/components/marketing/Navbar';
import HeroSection from '@/components/marketing/HeroSection';
import ChatSection from '@/components/marketing/ChatSection';
import CoreLoop from '@/components/marketing/CoreLoop';
import QuoteSection from '@/components/marketing/QuoteSection';
import FeaturesSection from '@/components/marketing/FeaturesSection';
import DayInLife from '@/components/marketing/DayInLife';
import PlatformsSection from '@/components/marketing/PlatformsSection';
import CompareSection from '@/components/marketing/CompareSection';
import PricingSection from '@/components/marketing/PricingSection';
import FAQSection from '@/components/marketing/FAQSection';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Modus — AI Life OS',
  description:
    'Tell Modus your goals. It builds the plan, tracks your habits, triages your inbox, and tells you exactly what to focus on — every morning. You approve every action.',
  openGraph: {
    title: 'Modus — AI Life OS',
    description: 'The AI personal operating system. Connects your goals, habits, inbox, and calendar. Acts with your approval. Nothing runs without you.',
    url: 'https://moduspilot.com',
    siteName: 'Modus',
  },
};

export default function MarketingPage() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ChatSection />
      <CoreLoop />
      <QuoteSection />
      <FeaturesSection />
      <DayInLife />
      <PlatformsSection />
      <CompareSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
