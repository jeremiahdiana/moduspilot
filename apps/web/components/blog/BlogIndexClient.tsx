'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import MarketingDecor from '@/components/marketing/MarketingDecor';
import { BlogHero } from './BlogHero';
import type { Post } from '@/lib/blog/types';

/**
 * The blog index.
 *
 * 🎨 Wrapped in the `marketing` + light/dark token shell, same as / and /pricing.
 * The first version skipped it and inherited the app's globally forced `.dark`,
 * so the blog rendered near-black while every other marketing page rendered
 * light. Nothing errored — it just looked like a different website.
 *
 * Layout follows the pattern that works on comparison blogs: one featured post
 * with the headline set over the art, then a compact month-grouped index rather
 * than a wall of large cards. The compact list matters at this size — five posts
 * as full-bleed cards reads as an empty blog, five posts as a dated timeline
 * reads as an archive.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1] ?? '';
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]?.slice(0, 3)} ${Number(d)}`;
}

function TagIcon({ tag }: { tag: string }) {
  // Guides get the book, comparisons the columns. Purely a visual anchor for the
  // row so the list scans as a timeline rather than a paragraph of links.
  const isGuide = tag === 'Guides';
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand/70 text-white shadow-sm">
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {isGuide
          ? <><path d="M3 4.5h5a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5H3z" /><path d="M17 4.5h-5a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5H17z" /></>
          : <><rect x="3" y="4" width="5.5" height="12" rx="1" /><rect x="11.5" y="4" width="5.5" height="12" rx="1" /></>}
      </svg>
    </span>
  );
}

export function BlogIndexClient({ posts }: { posts: Post[] }) {
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('All');

  const featured = posts[0];

  const tags = useMemo(
    () => ['All', ...Array.from(new Set(posts.flatMap(p => p.tags)))],
    [posts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(p => {
      if (tag !== 'All' && !p.tags.includes(tag)) return false;
      if (!q) return true;
      return `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [posts, query, tag]);

  // Group into month buckets, preserving the newest-first order of `filtered`.
  const groups = useMemo(() => {
    const out: { label: string; items: Post[] }[] = [];
    for (const p of filtered) {
      const label = monthLabel(p.published);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(p);
      else out.push({ label, items: [p] });
    }
    return out;
  }, [filtered]);

  return (
    <div className={`marketing ${dark ? 'marketing-dark-tokens' : 'marketing-light-tokens'}`}>
      <Navbar marketingTheme={dark ? 'dark' : 'light'} onToggleTheme={() => setDark(d => !d)} />

      {/* 🪤 `overflow-x-clip`, NOT `overflow-x-hidden`. The other marketing
          pages use `hidden`, and copying it here silently re-broke the sticky
          CTA rail on the post page: `hidden` makes this a scroll container and
          a scroll container disables `position: sticky` for every descendant.
          Same trap as the html/body rule in globals.css, one layer down. */}
      <main className="bg-bg text-text min-h-screen overflow-x-clip relative">
        <MarketingDecor dark={dark} />

        <div className="relative mx-auto w-full max-w-4xl px-5 pt-36 pb-28 sm:px-8" style={{ zIndex: 2 }}>
          <header className="text-center">
            <h1 className="text-[3rem] sm:text-[3.75rem] leading-[1.05] tracking-tight text-text">Blog</h1>
            <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-[1.7] text-muted">
              Honest comparisons of the AI subscriptions people actually pay for, with real
              prices you can check.
            </p>
          </header>

          {/* Featured — headline set over the art, like the reference layout. */}
          {featured && (
            <Link href={`/blog/${featured.slug}`} className="group relative mt-12 block overflow-hidden rounded-2xl">
              <BlogHero post={featured} variant="watermark" />
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {featured.tags.map(t => (
                    <span key={t} className="rounded-full bg-white/20 px-2.5 py-1 font-medium text-white backdrop-blur-sm">{t}</span>
                  ))}
                  <span className="text-white/80">
                    {shortDate(featured.published)}, {featured.published.slice(0, 4)}
                  </span>
                  <span className="text-white/80">{featured.readMinutes} min read</span>
                </div>
                <div>
                  <h2 className="max-w-lg text-[1.5rem] sm:text-[2rem] font-medium leading-[1.15] text-white drop-shadow-sm">
                    {featured.title}
                  </h2>
                  <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-transform group-hover:translate-x-0.5">
                    Read Full Article
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          )}

          <div className="mt-10">
            <label className="relative block">
              <span className="sr-only">Search for posts</span>
              <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5 17 17" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for posts"
                className="w-full rounded-full border border-border bg-panel py-3 pl-11 pr-4 text-[0.9375rem] text-text placeholder:text-muted focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  aria-pressed={tag === t}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    tag === t
                      ? 'border-text bg-text text-bg'
                      : 'border-border bg-panel text-muted hover:text-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12">
            {groups.length === 0 && (
              <p className="py-16 text-center text-muted">No posts match that search.</p>
            )}
            {groups.map(group => (
              <section key={group.label} className="mb-2">
                <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted">{group.label}</h3>
                <ul>
                  {group.items.map(p => (
                    <li key={p.slug} className="relative pb-10 last:pb-0">
                      {/* The connector line, same device as the reference. */}
                      <span aria-hidden className="absolute left-[1.375rem] top-12 bottom-2 w-px bg-border" />
                      <Link href={`/blog/${p.slug}`} className="group relative flex gap-4">
                        <TagIcon tag={p.tags[0]} />
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[1.0625rem] font-medium leading-snug text-text group-hover:text-brand transition-colors">
                            {p.title}
                          </p>
                          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                            <span className="text-text/70">{p.author}</span>
                            <time dateTime={p.published}>{shortDate(p.published)}</time>
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="mt-20 text-center">
            <h2 className="text-[2rem] sm:text-[2.5rem] leading-tight tracking-tight text-text">Stay updated</h2>
            <p className="mx-auto mt-3 max-w-md text-[1.0625rem] text-muted">
              Every frontier model in one subscription, side by side.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                See pricing
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-6 py-3 text-sm font-semibold text-text transition-colors hover:border-text/30"
              >
                See how it works
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
