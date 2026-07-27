import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { BlogHero } from '@/components/blog/BlogHero';
import { sortedPosts } from '@/lib/blog/posts';

export const metadata: Metadata = {
  title: 'Blog — Modus',
  description:
    'Honest comparisons of the AI subscriptions people actually pay for, with real prices and a clear note on what each one is best at.',
  alternates: { canonical: 'https://moduspilot.com/blog' },
  openGraph: {
    title: 'MODUS Blog',
    description: 'Honest comparisons of the AI subscriptions people actually pay for.',
    url: 'https://moduspilot.com/blog',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: "Modus — the only AI you'll ever need." }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MODUS Blog',
    description: 'Honest comparisons of the AI subscriptions people actually pay for.',
    images: ['/og.png'],
  },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export default function BlogIndex() {
  const posts = sortedPosts();

  return (
    <main className="min-h-screen bg-bg">
      <Navbar solid />
      <div className="mx-auto w-full max-w-5xl px-5 pt-32 pb-24 sm:px-8">
        <header className="mb-14">
          <h1 className="font-serif text-[2.5rem] sm:text-[3.25rem] leading-[1.08] text-text">Blog</h1>
          <p className="mt-4 max-w-xl text-[1.0625rem] leading-[1.7] text-muted">
            Honest comparisons of the AI subscriptions people actually pay for. Real prices, and a
            clear note on which tool each reader should pick, including when that is not us.
          </p>
        </header>

        <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2">
          {posts.map(post => (
            <article key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block">
                <BlogHero post={post} compact />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted">
                  <time dateTime={post.published}>{formatDate(post.published)}</time>
                  {' · '}{post.readMinutes} min read
                </p>
                <h2 className="mt-1.5 font-sans text-xl font-semibold leading-snug text-text group-hover:text-brand-light transition-colors">
                  {post.title}
                </h2>
                <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted">{post.excerpt}</p>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
