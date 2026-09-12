import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog | Modus',
  description: 'What is new in Modus: the free plan on the open models, Screen Assist, compare mode, mid-thread model switching and more.',
  alternates: { canonical: 'https://moduspilot.com/changelog' },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
