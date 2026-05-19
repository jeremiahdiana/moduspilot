import type { Metadata } from 'next';
import Navbar from '@/components/marketing/Navbar';
import HeroSection from '@/components/marketing/HeroSection';
import CoreLoop from '@/components/marketing/CoreLoop';
import QuoteSection from '@/components/marketing/QuoteSection';
import FeaturesSection from '@/components/marketing/FeaturesSection';
import ChatSection from '@/components/marketing/ChatSection';
import PlatformsSection from '@/components/marketing/PlatformsSection';
import ModusVsPilot from '@/components/marketing/ModusVsPilot';
import PricingSection from '@/components/marketing/PricingSection';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Modus — Your AI Chief of Staff',
  description:
    'Stop managing yourself. Modus is your AI chief of staff — it tracks your goals, clears your plate, and tells you what to focus on next.',
  openGraph: {
    title: 'Modus — Your AI Chief of Staff',
    description: 'The AI that runs your week. Modus monitors what matters, surfaces what\'s urgent, and acts on your behalf — with your approval.',
    url: 'https://moduspilot.com',
    siteName: 'Modus',
  },
};

export default function MarketingPage() {
  return (
    <main className="bg-bg text-text min-h-screen overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <CoreLoop />
      <QuoteSection />
      <FeaturesSection />
      <ChatSection />
      <PlatformsSection />
      <ModusVsPilot />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
