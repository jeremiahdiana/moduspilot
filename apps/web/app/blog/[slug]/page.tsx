import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostShell } from '@/components/blog/BlogPostShell';
import { BlogHero } from '@/components/blog/BlogHero';
import { BlogBlock, stripInline } from '@/components/blog/BlogContent';
import { BlogFaq } from '@/components/blog/BlogFaq';
import { POSTS, getPost } from '@/lib/blog/posts';
import { tableOfContents } from '@/lib/blog/types';

const SITE = 'https://moduspilot.com';

/** Static params — every post is known at build time, so every page prerenders. */
export function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${SITE}/blog/${post.slug}`;
  return {
    title: `${post.title} — Modus`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.description,
      siteName: 'Modus',
      publishedTime: post.published,
      modifiedTime: post.updated,
      authors: [post.author],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: ['/og.png'],
    },
  };
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const toc = tableOfContents(post);
  const related = post.related.map(getPost).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const url = `${SITE}/blog/${post.slug}`;

  /**
   * Three schema types, each doing a different job:
   *  - Article       → the byline, dates and headline in the result
   *  - FAQPage       → the People Also Ask box, which is the point of the FAQ block
   *  - BreadcrumbList→ the breadcrumb trail instead of a bare URL
   * stripInline is used throughout: JSON-LD wants plain text, and leaking `**`
   * into a rich result is the kind of thing nobody notices for months.
   */
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.published,
      dateModified: post.updated,
      author: { '@type': 'Person', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: 'MODUS',
        logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      image: `${SITE}/og.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: stripInline(f.a) },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 2, name: post.title, item: url },
      ],
    },
  ];

  return (
    <BlogPostShell>
      <script
        type="application/ld+json"
        // Schema is built from typed post data above, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto w-full max-w-6xl px-5 pt-32 pb-24 sm:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/blog" className="hover:text-text transition-colors">Blog</Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-text/70">{post.tags[0]}</span>
        </nav>

        <header className="max-w-3xl">
          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="rounded-full bg-text px-3 py-1 text-xs font-medium text-bg">{tag}</span>
            ))}
          </div>
          <h1 className="font-serif text-[2.25rem] sm:text-[3rem] leading-[1.08] text-text">{post.title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <time dateTime={post.published}>{formatDate(post.published)}</time>
            <span aria-hidden>·</span>
            <span>{post.readMinutes} min read</span>
            <span aria-hidden>·</span>
            <span className="text-text/70">{post.author}</span>
          </p>
          <p className="mt-5 text-[1.125rem] leading-[1.65] text-muted">{post.excerpt}</p>
        </header>

        <div className="mt-9">
          <BlogHero post={post} />
        </div>

        {/* Content left, sticky rail right. The rail is the CTA plus the TOC,
            which is the Cluely layout and it works because the CTA is visible at
            every scroll position without ever sitting inside the reading column. */}
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="min-w-0 max-w-3xl">
            {post.body.map((block, i) => <BlogBlock key={i} block={block} index={i} />)}
            <BlogFaq faq={post.faq} />

            {post.updated !== post.published && (
              <p className="mt-12 text-sm text-muted">
                Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time>.
              </p>
            )}
            <p className="mt-3 text-sm text-muted">
              Prices and model lists were verified against each product&rsquo;s published pricing on{' '}
              <time dateTime={post.updated}>{formatDate(post.updated)}</time>. This category moves fast.
              If you spot something out of date,{' '}
              <a href="mailto:hello@moduspilot.com" className="text-brand-light underline underline-offset-4">tell us</a>{' '}
              and we will correct it.
            </p>
          </article>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-text p-6 text-bg">
              <p className="font-display text-[1.375rem] leading-[1.2] font-medium">
                Every frontier model, one subscription
              </p>
              <p className="mt-2 text-sm leading-relaxed opacity-70">
                Ten models side by side, with the exact model named on every answer.
              </p>
              <Link
                href="/pricing"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-bg px-4 py-3 text-sm font-semibold text-text transition-opacity hover:opacity-90"
              >
                See pricing
                <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            {toc.length > 0 && (
              <nav aria-label="Table of contents" className="mt-8">
                <p className="mb-3 text-sm text-muted">Table of contents</p>
                <ul className="space-y-2.5 border-l border-border">
                  {toc.map(item => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="-ml-px block border-l border-transparent pl-4 text-sm leading-snug text-muted hover:border-brand hover:text-text transition-colors"
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-24 border-t border-border pt-12">
            <p className="text-sm text-muted">Other posts</p>
            <h2 className="mt-1 font-serif text-[1.75rem] leading-tight text-text">Check out more of our stories.</h2>
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="group block">
                  <BlogHero post={r} compact />
                  <p className="mt-3 text-sm text-muted">
                    <time dateTime={r.published}>{formatDate(r.published)}</time> · {r.readMinutes} min read
                  </p>
                  <h3 className="mt-1.5 font-sans text-lg font-semibold leading-snug text-text group-hover:text-brand-light transition-colors">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm leading-[1.6] text-muted">{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </BlogPostShell>
  );
}
