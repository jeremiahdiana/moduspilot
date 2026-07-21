import type { Metadata } from 'next';
import MarketingHome from '@/components/marketing/MarketingHome';

export const metadata: Metadata = {
  title: 'Modus',
  description:
    'Modus runs your day: goals, habits, tasks, and a briefing every morning, with every frontier AI model behind it. One subscription.',
  alternates: {
    canonical: 'https://moduspilot.com',
  },
  openGraph: {
    title: 'Modus',
    description: 'Modus runs your day: goals, habits, tasks, and a briefing every morning, with every frontier AI model behind it. One subscription.',
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
    title: 'Modus',
    description: 'Modus runs your day: goals, habits, tasks, and a briefing every morning, with every frontier AI model behind it. One subscription.',
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
      <MarketingHome />
    </>
  );
}
