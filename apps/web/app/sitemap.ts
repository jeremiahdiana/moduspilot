import type { MetadataRoute } from 'next';
import { sortedPosts } from '@/lib/blog/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  // Derived from the posts array, not hand-listed: a post that ships without a
  // sitemap entry is a page Google may never crawl, and that failure is silent.
  const posts: MetadataRoute.Sitemap = sortedPosts().map(post => ({
    url: `https://moduspilot.com/blog/${post.slug}`,
    lastModified: new Date(`${post.updated}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: 'https://moduspilot.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...posts,
    {
      url: 'https://moduspilot.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://moduspilot.com/features',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://moduspilot.com/pricing',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
