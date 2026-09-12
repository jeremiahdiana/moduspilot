import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Modus for Mac',
  description: 'Download the native Modus desktop app for Mac, Intel and Apple Silicon. Signed, notarized, and auto-updating.',
  alternates: {
    canonical: 'https://moduspilot.com/download/mac',
  },
  openGraph: {
    title: 'Download Modus for Mac',
    description: 'The native Modus desktop app, your notes, iMessage, reminders, and calendar, synced in.',
    url: 'https://moduspilot.com/download/mac',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Modus: every frontier model, one subscription.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Modus for Mac',
    description: 'The native Modus desktop app, your notes, iMessage, reminders, and calendar, synced in.',
    images: ['/og.png'],
  },
};

export default function DownloadMacLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
