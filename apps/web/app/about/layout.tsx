import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — Modus',
  description: 'MODUS is one AI for your whole life: every frontier model in one chat, connected to your inbox, calendar and apps, private by default.',
  alternates: { canonical: 'https://moduspilot.com/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
