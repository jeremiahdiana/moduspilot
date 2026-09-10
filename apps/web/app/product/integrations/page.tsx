'use client';

import Link from 'next/link';
import MarketingShell from '@/components/marketing/MarketingShell';

type Item = { name: string; detail: string; plan?: string };
type Section = { title: string; blurb: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: 'Email and calendar',
    blurb: 'Triage what matters, draft and send replies, and reschedule your day. Every action waits on an approval card first.',
    items: [
      { name: 'Gmail', detail: 'Read, triage, draft and send.' },
      { name: 'Outlook', detail: 'Read, triage, draft and send.' },
      { name: 'Google Calendar', detail: 'Read and write, reschedule and create events.' },
    ],
  },
  {
    title: 'Files and knowledge',
    blurb: 'Pull real context from your own documents so answers are grounded in your work, not guesses.',
    items: [
      { name: 'Google Drive', detail: 'Search and read your documents.' },
      { name: 'Notion', detail: 'Read your pages and databases.', plan: 'PILOT' },
    ],
  },
  {
    title: 'Work',
    blurb: 'Keep MODUS in the loop on the tools your team actually runs on.',
    items: [
      { name: 'GitHub', detail: 'Issues, pull requests and repositories.' },
      { name: 'Slack', detail: 'Read and post, stay on top of threads.', plan: 'PILOT' },
      { name: 'Linear', detail: 'Track issues and projects.', plan: 'PILOT' },
    ],
  },
  {
    title: 'Apple, on Mac and iPhone',
    blurb: 'The apps you already live in, connected through the Mac and iPhone apps.',
    items: [
      { name: 'iMessage', detail: 'Read and draft messages.' },
      { name: 'Apple Notes', detail: 'Search and read your notes.' },
      { name: 'Reminders', detail: 'Read and create reminders.' },
      { name: 'Contacts', detail: 'Look up the people you know.' },
      { name: 'Photos', detail: 'Find and reference your photos.' },
      { name: 'Apple Health', detail: 'Your health and activity data.' },
    ],
  },
  {
    title: 'Money and health',
    blurb: 'The executive layer on PILOT: a live pulse on the numbers that matter.',
    items: [
      { name: 'Plaid', detail: 'A financial pulse across your accounts.', plan: 'PILOT' },
      { name: 'Oura', detail: 'Sleep and recovery.', plan: 'PILOT' },
      { name: 'Whoop', detail: 'Strain and recovery.', plan: 'PILOT' },
      { name: 'HealthKit', detail: 'Wearable and health metrics.', plan: 'PILOT' },
    ],
  },
  {
    title: 'Extend it yourself',
    blurb: 'Anything with an MCP server plugs straight in, so you are never limited to the list above.',
    items: [
      { name: 'MCP servers', detail: 'Connect any Model Context Protocol server.' },
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <MarketingShell>
      <section className="pt-36 pb-14 px-6 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Integrations</p>
        <h1 className="text-5xl md:text-6xl text-text tracking-tight leading-[1.08] mb-5">
          Your whole life,<br />connected
        </h1>
        <p className="text-muted text-lg max-w-2xl leading-relaxed">
          MODUS reads your inbox, calendar, files and apps only to surface what matters, and it never sends
          or changes anything without your approval.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn-ink px-6 py-3 text-sm">Start free</Link>
          <Link href="/pricing" className="btn-outline px-6 py-3 text-sm">See pricing</Link>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-16">
        {SECTIONS.map(section => (
          <section key={section.title} className="py-12 border-t border-border">
            <div className="grid md:grid-cols-[260px_1fr] gap-8 md:gap-12">
              <div className="md:sticky md:top-24 self-start">
                <h2 className="text-2xl sm:text-3xl text-text tracking-tight mb-3">{section.title}</h2>
                <p className="text-sm text-muted leading-relaxed">{section.blurb}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
              {section.items.map(item => (
                <div key={item.name} className="rounded-xl border border-border bg-panel p-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-base font-semibold text-text">{item.name}</span>
                    {item.plan && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted border border-border rounded-full px-2 py-0.5">
                        {item.plan}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted leading-relaxed">{item.detail}</p>
                </div>
              ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl text-text tracking-tight mb-5">Connect everything. One subscription.</h2>
        <Link href="/login" className="btn-ink px-8 py-3.5 text-base">Start free</Link>
      </section>
    </MarketingShell>
  );
}
