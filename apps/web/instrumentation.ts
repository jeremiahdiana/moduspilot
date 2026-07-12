// Loads the right Sentry runtime config. Only runs when the instrumentation hook
// is enabled (next.config enables it only when NEXT_PUBLIC_SENTRY_DSN is set), and
// each config no-ops without a DSN — so this is doubly inert until configured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown in nested React Server Components (Next 15+ calls this;
// harmless no-op on Next 14).
export { captureRequestError as onRequestError } from '@sentry/nextjs';
