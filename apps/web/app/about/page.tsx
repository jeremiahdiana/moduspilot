'use client';

import Link from 'next/link';
import MarketingShell from '@/components/marketing/MarketingShell';

const PRINCIPLES = [
  {
    title: 'Every model, not one',
    body: 'The best model changes with the task. Modus gives you Claude, GPT-5.6, Gemini, Llama and DeepSeek in one chat, on Auto or picked per message, so you never bet your work on a single provider.',
  },
  {
    title: 'Connected to your life',
    body: 'An AI that cannot see your inbox, calendar or files can only ever guess. Modus connects to the apps you already use and grounds its answers in your real context.',
  },
  {
    title: 'You stay in control',
    body: 'Every action that changes something, sending an email, moving a meeting, waits on an approval card first. Nothing runs without you.',
  },
  {
    title: 'Private by default',
    body: 'Your data is never sold or used to train models. Your conversations, goals and memory live in your own database, and you can view and delete everything Modus knows about you.',
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="pt-36 pb-14 px-6 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">About</p>
        <h1 className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5">
          One AI for<br />your whole life
        </h1>
        <p className="text-muted text-lg max-w-2xl leading-relaxed">
          Most people now juggle five AI subscriptions, and none of them know your calendar, your inbox or
          what you decided last week. Modus is the opposite: every frontier model in one place, connected to
          your life, for one subscription.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border">
        <div className="grid md:grid-cols-[260px_1fr] gap-8 md:gap-12">
          <h2 className="text-2xl sm:text-3xl text-text tracking-tight md:sticky md:top-24 self-start">Why Modus exists</h2>
          <div className="space-y-4 text-muted leading-relaxed max-w-2xl">
            <p>
              The frontier models are extraordinary and getting better every month, but they arrive as a pile
              of separate apps: one for chat, one for research, one for images, each with its own bill and its
              own blank memory. You end up as the integration layer, copying context between tools that will
              never know you.
            </p>
            <p>
              Modus collapses that into one product. Ask any model in a single chat. Leave it on Auto and each
              message routes to whatever fits. Connect your inbox, calendar and files so answers are grounded in
              your real work, and let it draft, schedule and act, always with your approval. It remembers what
              you told it, so you are not starting from zero every morning.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border">
        <div className="grid md:grid-cols-[260px_1fr] gap-8 md:gap-12">
          <h2 className="text-2xl sm:text-3xl text-text tracking-tight md:sticky md:top-24 self-start">What we believe</h2>
          <div className="grid sm:grid-cols-2 gap-4 self-start">
            {PRINCIPLES.map(p => (
              <div key={p.title} className="rounded-xl border border-border bg-panel p-6">
                <h3 className="text-base font-semibold text-text mb-2">{p.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-border">
        <h2 className="text-3xl md:text-4xl text-text tracking-tight mb-5">See it for yourself.</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn-ink px-8 py-3.5 text-base">Start free</Link>
          <Link href="/pricing" className="btn-outline px-8 py-3.5 text-base">See pricing</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
