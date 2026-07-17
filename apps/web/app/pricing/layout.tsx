import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Modus',
  description: 'Try MODUS free for 3 days, then $24/mo. Replaces an entire cognitive workflow — goals, tasks, habits, triage, and execution.',
  alternates: {
    canonical: 'https://moduspilot.com/pricing',
  },
  openGraph: {
    title: 'Modus Pricing',
    // NOT "Free to start" — a card is required to begin the 3-day trial, and
    // there is no free tier behind it (chat 402s without a subscription).
    description: '3 days free, then $24/mo for the full operating system. $59/mo for founders and executives.',
    url: 'https://moduspilot.com/pricing',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Modus — every frontier model, one subscription.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modus Pricing',
    // NOT "Free to start" — a card is required to begin the 3-day trial, and
    // there is no free tier behind it (chat 402s without a subscription).
    description: '3 days free, then $24/mo for the full operating system. $59/mo for founders and executives.',
    images: ['/og.png'],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
