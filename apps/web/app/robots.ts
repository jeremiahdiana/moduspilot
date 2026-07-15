import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/features', '/pricing'],
      disallow: ['/dashboard', '/chat', '/goals', '/habits', '/tasks', '/briefing', '/settings', '/onboarding', '/login'],
    },
    sitemap: 'https://moduspilot.com/sitemap.xml',
  };
}
