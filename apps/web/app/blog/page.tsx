import type { Metadata } from 'next';
import { sortedPosts } from '@/lib/blog/posts';
import { BlogIndexClient } from '@/components/blog/BlogIndexClient';

export const metadata: Metadata = {
  // The root layout sets title.template to '%s | Modus', which is applied to this
  // string. Spelling the suffix out here as well rendered 'Blog | Modus | Modus'
  // on every blog page, which was live. Let the template add it, once.
  title: 'Blog',
  description:
    'Honest comparisons of the AI subscriptions people actually pay for, with real prices and a clear note on what each one is best at.',
  alternates: { canonical: 'https://moduspilot.com/blog' },
  openGraph: {
    title: 'Modus Blog',
    description: 'Honest comparisons of the AI subscriptions people actually pay for.',
    url: 'https://moduspilot.com/blog',
    siteName: 'Modus',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: "Modus: the only AI you'll ever need." }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modus Blog',
    description: 'Honest comparisons of the AI subscriptions people actually pay for.',
    images: ['/og.png'],
  },
};

export default function BlogIndex() {
  return <BlogIndexClient posts={sortedPosts()} />;
}
