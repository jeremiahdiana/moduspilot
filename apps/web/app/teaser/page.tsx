import type { Metadata } from 'next';
import TeaserDeck from '@/components/marketing/TeaserDeck';

export const metadata: Metadata = {
  title: 'MODUS — Overview',
  description: 'MODUS: The AI Operating System for Your Life.',
  robots: { index: false, follow: false },
};

export default function TeaserPage() {
  return <TeaserDeck />;
}
