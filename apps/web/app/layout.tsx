import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { GlobalErrorCapture } from '@/components/GlobalErrorCapture';

export const metadata: Metadata = {
  metadataBase: new URL('https://moduspilot.com'),
  title: {
    default: 'Modus',
    template: '%s | Modus',
  },
  description: 'Stop managing yourself. Modus is your AI chief of staff — it tracks your goals, clears your plate, and tells you what to focus on next.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    url: 'https://moduspilot.com',
    title: 'Modus',
    description: 'Stop managing yourself. Modus is your AI chief of staff — it tracks your goals, clears your plate, and tells you what to focus on next.',
    siteName: 'Modus',
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
    description: 'Stop managing yourself. Modus is your AI chief of staff — it tracks your goals, clears your plate, and tells you what to focus on next.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&f[]=sentient@400,500,700&display=swap" />
        {/* Always start dark. Light mode is in-session only and never persisted. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            localStorage.removeItem('modus-theme');
            document.documentElement.classList.add('dark');
          })();
        ` }} />
      </head>
      <body>
        <GlobalErrorCapture />
        <QueryProvider>
          {children}
        </QueryProvider>
        {/* Pageviews only. MODUS shipped with no analytics of any kind, which
            means "nobody visits" and "everybody bounces" were indistinguishable
            — two problems with opposite fixes. Needs Web Analytics enabled on
            the project in the Vercel dashboard; until then the script no-ops. */}
        <Analytics />
      </body>
    </html>
  );
}
