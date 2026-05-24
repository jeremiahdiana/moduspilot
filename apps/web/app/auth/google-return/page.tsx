'use client';

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

// Intermediary page: re-establishes the Firebase session with a custom token
// after the Google OAuth redirect, then forwards to the final destination.
export default function GoogleReturnPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') ?? '';
    const email = params.get('email') ?? '';
    const origin = params.get('origin') ?? 'settings';

    const onError = () => {
      router.replace(
        origin === 'onboarding'
          ? '/onboarding?error=google_failed'
          : '/settings?tab=connectors&error=google_failed'
      );
    };

    if (!token) { onError(); return; }

    signInWithCustomToken(auth, token)
      .then(() => {
        if (origin === 'onboarding') {
          router.replace(`/onboarding?connected=${encodeURIComponent(email)}`);
        } else {
          router.replace(`/settings?tab=connectors&connected=${encodeURIComponent(email)}`);
        }
      })
      .catch(onError);
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
