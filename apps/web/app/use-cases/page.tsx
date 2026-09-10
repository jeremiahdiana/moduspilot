'use client';

import Link from 'next/link';
import MarketingShell from '@/components/marketing/MarketingShell';

type UseCase = { eyebrow: string; title: string; blurb: string; workflows: string[] };

const CASES: UseCase[] = [
  {
    eyebrow: 'For founders',
    title: 'Run the whole company from one place',
    blurb: 'You are the bottleneck on ten fronts. MODUS keeps the plates spinning and routes the hard problems to the best model.',
    workflows: [
      'A morning briefing of your top priorities, overdue tasks and habits at risk',
      'Draft and send investor updates and cold emails, approved before they go',
      'Triage the inbox down to what actually needs you',
      'Ask several frontier models a hard question and get one clear answer',
    ],
  },
  {
    eyebrow: 'For executives',
    title: 'Walk into every meeting prepared',
    blurb: 'PILOT adds an executive layer: the context, relationships and numbers that decide how a day goes.',
    workflows: [
      'Meeting intelligence before and after: who, what matters, what to follow up',
      'A relationship CRM that remembers the people you work with',
      'Reschedule the day and clear conflicts from a single ask',
      'A financial pulse across your accounts via Plaid',
    ],
  },
  {
    eyebrow: 'For your personal life',
    title: 'Keep your life from slipping',
    blurb: 'Goals, habits and the endless admin, handled quietly in the background so you can focus on what matters.',
    workflows: [
      'A habit engine and goals that MODUS actually checks in on',
      'An end-of-day reflection that closes the loop',
      'Life admin automation: reminders, bookings and follow-ups',
      'Wearable sync so your energy and recovery inform the plan',
    ],
  },
];

export default function UseCasesPage() {
  return (
    <MarketingShell>
      <section className="pt-36 pb-14 px-6 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Use cases</p>
        <h1 className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5">
          One tool,<br />many jobs
        </h1>
        <p className="text-muted text-lg max-w-2xl leading-relaxed">
          MODUS is built for people with too much to hold in their head. Here is how founders, executives and
          busy people actually use it.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-10 space-y-6">
        {CASES.map(uc => (
          <section key={uc.title} className="rounded-2xl border border-border bg-panel p-8 sm:p-10">
            <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">{uc.eyebrow}</p>
            <h2 className="text-2xl sm:text-3xl text-text tracking-tight mb-3">{uc.title}</h2>
            <p className="text-muted max-w-2xl leading-relaxed mb-6">{uc.blurb}</p>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {uc.workflows.map(w => (
                <li key={w} className="flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-4 h-4 shrink-0 mt-0.5 text-text">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="text-sm text-text/90 leading-relaxed">{w}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl text-text tracking-tight mb-5">Put it to work.</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn-ink px-8 py-3.5 text-base">Start free</Link>
          <Link href="/pricing" className="btn-outline px-8 py-3.5 text-base">See pricing</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
