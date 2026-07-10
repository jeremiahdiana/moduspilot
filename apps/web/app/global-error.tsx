'use client';

import { useEffect } from 'react';

// global-error catches errors thrown in the ROOT layout itself — the one place
// app/error.tsx cannot reach. Because it REPLACES the root layout, it must render
// its own <html>/<body>, and globals.css/Tailwind is not guaranteed to be loaded
// here, so the UI is styled inline to stay presentable no matter what.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[modus:global-error]', error);
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          digest: error?.digest,
          scope: 'global-error',
          url: typeof window !== 'undefined' ? window.location.href : '',
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* reporting must never itself crash the boundary */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '0 24px',
          textAlign: 'center',
          background: '#0b0b0f',
          color: '#e5e5e5',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <p style={{ fontSize: 40, fontWeight: 700, margin: 0, color: '#fff' }}>500</p>
        <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>Something went wrong.</p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => reset()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#a78bfa',
              textDecoration: 'underline',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/';
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#9ca3af',
              textDecoration: 'underline',
            }}
          >
            Go home
          </button>
        </div>
        {error?.digest && (
          <p style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>Ref: {error.digest}</p>
        )}
      </body>
    </html>
  );
}
