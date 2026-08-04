import type { Metadata } from 'next';
import { FREE_MESSAGE_LIMIT } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Pricing — Modus',
  description: `Start free, no card. ${FREE_MESSAGE_LIMIT} messages on every frontier model, then $24/mo. Replaces an entire cognitive workflow: goals, tasks, habits, triage, and execution.`,
  alternates: {
    canonical: 'https://moduspilot.com/pricing',
  },
  openGraph: {
    title: 'Modus Pricing',
    // 💡 "Free to start" IS accurate as of 2026-08-04 and it is the whole point of
    // saying it here. These three descriptions used to argue the opposite, because
    // a card was required before the first message. That is what cold traffic saw
    // in the search result and the link preview, and it converted at ~0. A free
    // tier nobody is told about converts exactly as well as no free tier.
    // ⚠️ Keep the number in step with FREE_MESSAGE_LIMIT (lib/constants.ts).
    description: `Start free, no card. ${FREE_MESSAGE_LIMIT} messages on every frontier model, then $24/mo for the full operating system. $59/mo for founders and executives.`,
    url: 'https://moduspilot.com/pricing',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Modus — every frontier model, one subscription.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modus Pricing',
    // Same copy as openGraph above, and for the same reason. See that comment.
    description: `Start free, no card. ${FREE_MESSAGE_LIMIT} messages on every frontier model, then $24/mo for the full operating system. $59/mo for founders and executives.`,
    images: ['/og.png'],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
