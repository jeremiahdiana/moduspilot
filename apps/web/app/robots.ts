import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/how-it-works', '/pricing'],
      disallow: ['/dashboard', '/chat', '/goals', '/habits', '/tasks', '/settings', '/onboarding'],
    },
    sitemap: 'https://moduspilot.com/sitemap.xml',
  };
}
