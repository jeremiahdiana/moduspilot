'use client';

import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithRedirect, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import type { User } from 'firebase/auth';

// A `?next=` internal path (e.g. the founding claim flow returning to
// /grandfathering) takes precedence over the default routing. Same-origin paths
// only — never an absolute or protocol-relative URL — to avoid an open redirect.
function safeNext(): string | null {
  if (typeof window === 'undefined') return null;
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
}

async function getDestination(user: User): Promise<string> {
  const next = safeNext();
  if (next) return next;
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
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [checking, setChecking] = useState(true);
  // Hide the "Back to moduspilot.com" link inside the desktop shell — there is
  // no marketing site to go back to there. Set after mount to avoid a hydration
  // mismatch; the desktop shell tags its user-agent with "MODUSDesktop".
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(typeof navigator !== 'undefined' && navigator.userAgent.includes('MODUSDesktop'));
  }, []);

  // If already signed in, skip straight to the app
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        router.replace(await getDestination(user));
      } else {
        setChecking(false);
      }
    });
    return unsub;
  }, [router]);

  // Release the spinner if the user backs out of the OAuth window. In Electron
  // (and some browsers) Firebase's signInWithPopup can hang without ever
  // rejecting when the popup is closed, freezing the button forever. When focus
  // returns to our window after the popup closes, give Firebase a beat to settle
  // a real sign-in; if none happened, clear loading so the user can retry.
  useEffect(() => {
    if (!loading) return;
    const release = () => {
      window.setTimeout(() => {
        if (!auth.currentUser) setLoading(null);
      }, 1200);
    };
    window.addEventListener('focus', release);
    return () => window.removeEventListener('focus', release);
  }, [loading]);

  async function signIn(kind: 'google' | 'apple') {
    const provider = kind === 'google' ? googleProvider : appleProvider;
    setError(''); setLoading(kind);
    try {
      const result = await signInWithPopup(auth, provider);
      router.push(await getDestination(result.user));
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return; // navigating away; leave the spinner until the redirect lands
        } catch {
          setError('Sign in failed. Please try again.');
        }
      } else if (code !== 'auth/cancelled-popup-request' && code !== 'auth/popup-closed-by-user') {
        console.error('[sign-in error]', code, e);
        setError('Sign in failed. Please try again.');
      }
      setLoading(null);
    }
  }

  if (checking) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-50">
        <AnimatedThemeToggler />
      </div>

      {/* Calm, static, on-brand background — a single soft violet glow. */}
      <div className="fixed inset-0 -z-10 bg-bg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_58%_48%_at_50%_40%,rgba(124,58,237,0.13),transparent_70%)]" />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-sm mx-6"
      >
        <div className="bg-panel/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20">

          {/* Logo + wordmark */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/logo.png"
              alt="MODUS"
              width={104}
              height={84}
              className="object-contain block dark:hidden mb-4"
            />
            <Image
              src="/logo-dark.png"
              alt="MODUS"
              width={104}
              height={84}
              className="object-contain hidden dark:block mb-4"
            />
            {/* Sentient serif, the homepage face — the old Clash Display black
                at wide tracking read as a logo from a different product. */}
            <h1 className="hero-gradient-text font-serif text-[2.1rem] leading-none font-medium tracking-[0.06em]">MODUS</h1>
            <p className="text-muted text-[10px] tracking-[0.34em] uppercase mt-2">pilot</p>
            <p className="text-muted/70 text-sm mt-3 text-center leading-relaxed">
              Sign in to pick up where you left off.
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <button
              onClick={() => signIn('google')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 bg-bg/60 border border-border hover:border-brand/50 rounded-xl px-4 py-3.5 text-text text-sm font-medium transition-all hover:bg-brand/5 disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {loading === 'google' ? (
                <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              onClick={() => signIn('apple')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 bg-bg/60 border border-border hover:border-brand/50 rounded-xl px-4 py-3.5 text-text text-sm font-medium transition-all hover:bg-brand/5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading === 'apple' ? (
                <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              ) : (
                <svg className="w-4 h-4 fill-text shrink-0" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
              Continue with Apple
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center mt-4">{error}</p>
          )}

          {!isDesktop && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/')}
                className="text-muted/50 text-xs hover:text-muted transition-colors"
              >
                Back to moduspilot.com
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
