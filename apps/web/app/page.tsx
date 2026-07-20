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
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: "Modus — the only AI you'll ever need. Every frontier model, one subscription.",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modus — AI Life OS',
    description: 'The AI personal operating system. Connects your goals, habits, inbox, and calendar. Acts with your approval. Nothing runs without you.',
    images: ['/og.png'],
  },
};

export default function MarketingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Modus',
    url: 'https://moduspilot.com',
    logo: 'https://moduspilot.com/logo-with-text.png',
    sameAs: ['https://moduspilot.com'],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar light />
      <HomepageShell />
    </>
  );
}
