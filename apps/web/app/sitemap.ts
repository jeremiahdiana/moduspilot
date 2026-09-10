import type { MetadataRoute } from 'next';
import { sortedPosts } from '@/lib/blog/posts';

// Marketing routes, listed once. A page missing here is one Google may never
// crawl, and that failure is silent — so every public page belongs in this array.
const MARKETING_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                       priority: 1,   changeFrequency: 'weekly'  },
  { path: '/features',              priority: 0.8, changeFrequency: 'monthly' },
  { path: '/pricing',               priority: 0.8, changeFrequency: 'monthly' },
  { path: '/product/compare',       priority: 0.7, changeFrequency: 'monthly' },
  { path: '/product/integrations',  priority: 0.7, changeFrequency: 'monthly' },
  { path: '/use-cases',             priority: 0.7, changeFrequency: 'monthly' },
  { path: '/changelog',             priority: 0.6, changeFrequency: 'weekly'  },
  { path: '/about',                 priority: 0.6, changeFrequency: 'monthly' },
  { path: '/download/mac',          priority: 0.6, changeFrequency: 'monthly' },
  { path: '/blog',                  priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/privacy',               priority: 0.3, changeFrequency: 'yearly'  },
  { path: '/terms',                 priority: 0.3, changeFrequency: 'yearly'  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: MetadataRoute.Sitemap = MARKETING_ROUTES.map(r => ({
    url: `https://moduspilot.com${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Blog posts are derived from the posts array, not hand-listed.
  const posts: MetadataRoute.Sitemap = sortedPosts().map(post => ({
    url: `https://moduspilot.com/blog/${post.slug}`,
    lastModified: new Date(`${post.updated}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...routes, ...posts];
}
