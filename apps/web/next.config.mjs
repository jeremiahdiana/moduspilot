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
      // The site collapsed to Home + Pricing. /features (and its old alias
      // /how-it-works) fold into the homepage — keep indexed URLs alive.
      { source: '/features', destination: '/', permanent: true },
      { source: '/how-it-works', destination: '/', permanent: true },
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

// Sentry is opt-in: with no DSN the config is untouched (identical build). Set
// NEXT_PUBLIC_SENTRY_DSN (+ SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN for
// source-map upload) to activate error reporting. See .env.local.example.
let config = nextConfig;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = await import('@sentry/nextjs');
  config = {
    ...nextConfig,
    experimental: { ...nextConfig.experimental, instrumentationHook: true },
  };
  config = withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    // Only upload source maps when an auth token is present (else the build
    // would fail trying to authenticate).
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  });
}

export default config;
