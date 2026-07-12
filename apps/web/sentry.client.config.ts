// Sentry (browser). Inert until NEXT_PUBLIC_SENTRY_DSN is set, so the app builds
// and runs identically with no Sentry account configured. Set the DSN in Vercel
// to activate. See .env.local.example for the full activation checklist.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    // Keep volumes (and free-tier quota) sane; raise once you know your traffic.
    tracesSampleRate: 0.1,
    // Don't send default PII (IPs, etc.) — MODUS handles sensitive user data.
    sendDefaultPii: false,
  });
}
