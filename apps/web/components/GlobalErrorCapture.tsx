'use client';

import { useEffect } from 'react';

// Widens the crash net beyond React error boundaries. app/error.tsx only catches
// errors thrown during render; this also captures uncaught runtime errors, event-
// handler throws, and unhandled promise rejections, reporting them to
// /api/client-error (→ Vercel logs) the same way. Deduped + capped so a hot loop
// can't flood the endpoint. Renders nothing.
export function GlobalErrorCapture() {
  useEffect(() => {
    const seen = new Set<string>();
    let count = 0;

    function report(kind: string, message: string, stack?: string) {
      if (count >= 50) return; // hard cap per page session
      const key = `${kind}:${message}`;
      if (seen.has(key)) return; // collapse identical repeats
      seen.add(key);
      count++;
      try {
        fetch('/api/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `[${kind}] ${message ?? ''}`,
            stack: stack ?? '',
            url: window.location.href,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* the reporter must never itself throw */
      }
    }

    function onError(event: ErrorEvent) {
      // Ignore resource-load failures (img/script/link 404s): no Error object,
      // empty message. Those aren't app crashes and would be pure noise.
      if (!event.error && !event.message) return;
      report('window.onerror', event.message || String(event.error), event.error?.stack);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const r = event.reason;
      report('unhandledrejection', r?.message ?? String(r), r?.stack);
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
