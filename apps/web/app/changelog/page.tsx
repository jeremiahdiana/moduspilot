'use client';

import Link from 'next/link';
import MarketingShell from '@/components/marketing/MarketingShell';

type Entry = { date: string; title: string; body: string };

// Real releases, most recent first. Dates are month-level.
const ENTRIES: Entry[] = [
  {
    date: 'September 2026',
    title: 'A real free plan on the open models',
    body: 'Free accounts now get the open models (Llama, DeepSeek and Gemini Flash) with no card, on a rolling window that refreshes through the day. The frontier models stay on the paid plans.',
  },
  {
    date: 'September 2026',
    title: 'Screen Assist',
    body: 'Ask about anything on your screen from the Mac app with a keyboard shortcut. Capture a window and get an answer in context.',
  },
  {
    date: 'September 2026',
    title: 'Delete all chats',
    body: 'A danger-zone control in Settings to permanently wipe your entire chat history in one action.',
  },
  {
    date: 'September 2026',
    title: 'Auto Saver and a rolling usage window',
    body: 'An opt-in setting that routes routine messages to a cheaper model to stretch your limits, and a rolling window that refreshes usage through the day instead of a hard daily reset.',
  },
  {
    date: 'August 2026',
    title: 'Switch models mid-thread',
    body: 'Change the model partway through a conversation and it sticks for that thread, surviving a reload.',
  },
  {
    date: 'August 2026',
    title: 'Compare mode',
    body: 'Ask several models the same question at once and see their answers side by side, with one clear verdict.',
  },
  {
    date: 'July 2026',
    title: 'Every frontier model in one chat',
    body: 'Claude, GPT-5.6, Gemini, Llama and DeepSeek in the same conversation, with Auto routing each message to the model that fits the task.',
  },
];

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <section className="pt-36 pb-14 px-6 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Changelog</p>
        <h1 className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5">What&apos;s new</h1>
        <p className="text-muted text-lg max-w-xl leading-relaxed">
          The latest shipped to MODUS, across web, Mac and iPhone.
        </p>
      </section>

      <div className="max-w-2xl mx-auto px-6 pb-20">
        <ol className="relative border-l border-border ml-2">
          {ENTRIES.map(entry => (
            <li key={entry.title} className="ml-6 pb-10 last:pb-0">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-text/40" />
              <p className="text-xs uppercase tracking-wider text-muted mb-1">{entry.date}</p>
              <h2 className="text-lg font-semibold text-text mb-1.5">{entry.title}</h2>
              <p className="text-sm text-muted leading-relaxed">{entry.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center border-t border-border">
        <h2 className="text-3xl md:text-4xl text-text tracking-tight mb-5">Try the latest.</h2>
        <Link href="/login" className="btn-ink px-8 py-3.5 text-base">Start free</Link>
      </section>
    </MarketingShell>
  );
}
