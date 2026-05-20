'use client';

import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithRedirect } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from 'firebase/auth';

async function getDestination(user: User): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.data()?.onboardingComplete ? '/dashboard' : '/onboarding';
  } catch {
    return '/onboarding';
  }
}

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function signInWithGoogle() {
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      router.push(await getDestination(result.user));
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
      } else if (code !== 'auth/cancelled-popup-request' && code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
    }
  }

  async function signInWithApple() {
    setError('');
    try {
      const result = await signInWithPopup(auth, appleProvider);
      router.push(await getDestination(result.user));
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, appleProvider);
      } else if (code !== 'auth/cancelled-popup-request' && code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
    }
  }

  return (
    <div className="w-full max-w-sm px-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight text-text mb-2">MODUS</h1>
        <p className="text-muted text-sm">Your AI personal operating system</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-panel border border-border rounded-xl px-4 py-3.5 text-text font-medium hover:border-brand transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={signInWithApple}
          className="w-full flex items-center justify-center gap-3 bg-panel border border-border rounded-xl px-4 py-3.5 text-text font-medium hover:border-brand transition-colors"
        >
          <svg className="w-5 h-5 fill-text" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      {error && <p className="text-red-400 text-xs text-center mt-4">{error}</p>}

      <button
        onClick={() => router.push('/')}
        className="w-full text-center text-muted text-xs mt-6 hover:text-text transition-colors"
      >
        Continue without an account →
      </button>

      <p className="text-center text-muted text-xs mt-4">
        By signing in you agree to our Terms and Privacy Policy.
      </p>
    </div>
  );
}
