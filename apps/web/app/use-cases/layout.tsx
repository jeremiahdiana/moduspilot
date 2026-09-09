import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Use cases — Modus',
  description: 'How founders, executives and busy people use MODUS: daily briefings, inbox triage, meeting intelligence, goals and habits, all in one place.',
  alternates: { canonical: 'https://moduspilot.com/use-cases' },
};

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
