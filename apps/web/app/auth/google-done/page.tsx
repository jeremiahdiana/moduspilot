'use client';

import { useEffect } from 'react';

export default function GoogleDonePage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') ?? '';
    const error = params.get('error') ?? '';
    const origin = params.get('origin') ?? 'settings';

    // BroadcastChannel works across same-origin windows even when
    // window.opener is null (which happens after cross-origin navigation).
    try {
      const ch = new BroadcastChannel('google_oauth');
      ch.postMessage(
        error
          ? { type: 'google_error', error, origin }
          : { type: 'google_connected', email, origin }
      );
      ch.close();
    } catch {
      // BroadcastChannel not available — fall through to redirect
    }

    // Close if we're in a popup. If not (redirect mode), close() is a no-op
    // and the setTimeout below will navigate us to the right destination.
    window.close();

    setTimeout(() => {
      // Still here → we're in redirect mode (popup was blocked).
      // Navigate the main window to the destination so the OAuth handler
      // and Firestore-prefill can pick it up.
      if (origin === 'onboarding') {
        window.location.replace(
          error
            ? `/onboarding?error=${encodeURIComponent(error)}`
            : `/onboarding?connected=${encodeURIComponent(email)}`
        );
      } else {
        window.location.replace(
          error
            ? `/settings?tab=connectors&error=${encodeURIComponent(error)}`
            : `/settings?tab=connectors&connected=${encodeURIComponent(email)}`
        );
      }
    }, 300);
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
