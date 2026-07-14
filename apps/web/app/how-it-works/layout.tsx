import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works — Modus',
  description: 'Modus monitors your calendar, email, and goals in real time — then acts on your behalf. See how one message handles everything.',
  alternates: {
    canonical: 'https://moduspilot.com/how-it-works',
  },
  openGraph: {
    title: 'How Modus Works',
    description: 'One message. Everything handled. See how Modus goes from your words to real action.',
    url: 'https://moduspilot.com/how-it-works',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Modus — the AI that runs your life.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Modus Works',
    description: 'One message. Everything handled. See how Modus goes from your words to real action.',
    images: ['/og.png'],
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
