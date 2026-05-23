import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Modus — AI Life OS',
    template: '%s | Modus',
  },
  description: 'Stop managing yourself. Modus is your AI chief of staff — it tracks your goals, clears your plate, and tells you what to focus on next.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Inject theme before first paint to avoid flash. Defaults to dark. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('modus-theme');
            if (t === 'light') return;
            document.documentElement.classList.add('dark');
          })();
        ` }} />
      </head>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
