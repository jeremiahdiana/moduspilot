import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Modus',
  description: 'Try MODUS free for 3 days, then $24/mo. Replaces an entire cognitive workflow — goals, tasks, habits, triage, and execution.',
  alternates: {
    canonical: 'https://moduspilot.com/pricing',
  },
  openGraph: {
    title: 'Modus Pricing',
    description: 'Free to start. $24/mo for the full operating system. $59/mo for founders and executives.',
    url: 'https://moduspilot.com/pricing',
    siteName: 'Modus',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
