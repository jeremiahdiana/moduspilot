'use client';

import { useEffect } from 'react';

export default function GoogleDonePage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') ?? '';
    const error = params.get('error') ?? '';
    const origin = params.get('origin') ?? 'settings';

    const msg = error
      ? { type: 'google_error', error, origin }
      : { type: 'google_connected', email, origin };

    if (window.opener && !window.opener.closed) {
      // Popup mode: send result to the parent window and close
      window.opener.postMessage(msg, window.location.origin);
      window.close();
    } else {
      // Fallback (redirect mode): navigate directly to destination
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
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
