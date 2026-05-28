import type { Metadata } from 'next';
import PitchDeck from '@/components/marketing/PitchDeck';

export const metadata: Metadata = {
  title: 'MODUS — Investor Deck',
  description: 'MODUS: The AI Operating System for Your Life. Pre-seed pitch deck.',
  robots: { index: false, follow: false },
};

export default function DeckPage() {
  return <PitchDeck />;
}
