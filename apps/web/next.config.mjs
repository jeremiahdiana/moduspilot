/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@modus/shared'],

  async redirects() {
    return [
      // Redirect www → non-www (permanent)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.moduspilot.com' }],
        destination: 'https://moduspilot.com/:path*',
        permanent: true,
      },
      // Connections page was renamed to Capabilities — keep old bookmarks working.
      { source: '/connections', destination: '/capabilities', permanent: true },
    ];
  },

  async headers() {
    return [
      // Tell Google not to index auth-protected dashboard pages
      {
        source: '/(dashboard|chat|goals|habits|tasks|briefing|settings)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/(dashboard|chat|goals|habits|tasks|briefing|settings)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Also noindex the auth and onboarding flows
      {
        source: '/(login|onboarding)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/(login|onboarding)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
