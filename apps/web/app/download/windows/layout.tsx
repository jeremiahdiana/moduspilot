import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Modus for Windows',
  description: 'Download the native Modus desktop app for Windows 10 & 11. Your chat, notifications, and a tray presence, synced with every surface.',
  alternates: {
    canonical: 'https://moduspilot.com/download/windows',
  },
  openGraph: {
    title: 'Download Modus for Windows',
    description: 'The native Modus desktop app for Windows, synced with the web, Mac, and iPhone.',
    url: 'https://moduspilot.com/download/windows',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Modus: every frontier model, one subscription.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Modus for Windows',
    description: 'The native Modus desktop app for Windows, synced with the web, Mac, and iPhone.',
    images: ['/og.png'],
  },
};

export default function DownloadWindowsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
