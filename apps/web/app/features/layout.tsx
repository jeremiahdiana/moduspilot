import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — Modus',
  description: 'Modus monitors your calendar, email, and goals in real time — then acts on your behalf. See how one message handles everything.',
  alternates: {
    canonical: 'https://moduspilot.com/features',
  },
  openGraph: {
    title: 'MODUS Features',
    description: 'One message. Everything handled. See how Modus goes from your words to real action.',
    url: 'https://moduspilot.com/features',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: "Modus — the only AI you'll ever need." }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MODUS Features',
    description: 'One message. Everything handled. See how Modus goes from your words to real action.',
    images: ['/og.png'],
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
