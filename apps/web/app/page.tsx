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
  title: 'MODUS Pilot — Your AI Chief of Staff',
  description:
    'MODUS runs in the background of your life — monitoring, deciding, and surfacing what matters. Monitor. Decide. Approve. Execute.',
  openGraph: {
    title: 'MODUS Pilot — Your AI Chief of Staff',
    description: 'An AI personal operating system. Not a chatbot. An OS for your life.',
    url: 'https://moduspilot.com',
    siteName: 'MODUS Pilot',
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
