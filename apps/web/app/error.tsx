'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);

  // Capture the error so it stops being silently swallowed. Logs to the browser
  // console AND reports it server-side (→ Vercel logs) so intermittent crashes on
  // fast navigation are diagnosable without needing devtools open at the time.
  useEffect(() => {
    console.error('[modus:error-boundary]', error);
    try {
      const payload = JSON.stringify({
        message: error?.message,
        stack: error?.stack,
        digest: error?.digest,
        url: typeof window !== 'undefined' ? window.location.href : '',
      });
      // keepalive so the report still sends if the page is being navigated/torn down
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* reporting must never itself crash the boundary */
    }
  }, [error]);

  // `reset()` alone re-renders this segment against the SAME cached (broken) RSC
  // data, so if the cause is still there it re-throws instantly and the button
  // looks dead. Pairing it with router.refresh() re-fetches server data first.
  const tryAgain = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-4xl font-bold text-text">500</p>
      <p className="text-muted text-sm">Something went wrong.</p>
      <div className="flex items-center gap-4">
        <button
          onClick={tryAgain}
          disabled={pending}
          className="text-brand text-sm hover:underline disabled:opacity-50"
        >
          {pending ? 'Retrying…' : 'Try again'}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="text-muted text-sm hover:underline"
        >
          Reload page
        </button>
      </div>

      {error?.digest && (
        <p className="text-muted/60 text-[11px] mt-1">Ref: {error.digest}</p>
      )}

      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-2 max-w-xl w-full">
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="text-muted/70 text-[11px] hover:underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <pre className="mt-2 text-left text-[11px] text-muted/80 whitespace-pre-wrap break-words overflow-auto max-h-64 rounded-lg border border-border bg-panel p-3">
              {error?.message}
              {error?.stack ? `\n\n${error.stack}` : ''}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
