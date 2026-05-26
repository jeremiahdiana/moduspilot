import type { Metadata } from 'next';
import Navbar from '@/components/marketing/Navbar';
import HomepageShell from '@/components/marketing/HomepageShell';

export const metadata: Metadata = {
  title: 'Modus — AI Life OS',
  description:
    'Tell Modus your goals. It builds the plan, tracks your habits, triages your inbox, and tells you exactly what to focus on — every morning. You approve every action.',
  alternates: {
    canonical: 'https://moduspilot.com',
  },
  openGraph: {
    title: 'Modus — AI Life OS',
    description: 'The AI personal operating system. Connects your goals, habits, inbox, and calendar. Acts with your approval. Nothing runs without you.',
    url: 'https://moduspilot.com',
    siteName: 'Modus',
    type: 'website',
  },
};

export default function MarketingPage() {
  return (
    <>
      <Navbar />
      <HomepageShell />
    </>
  );
}
