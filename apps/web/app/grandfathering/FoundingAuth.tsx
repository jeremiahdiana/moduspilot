'use client';

import { useState } from 'react';
import {
  signInWithPopup, signInWithRedirect, GoogleAuthProvider, OAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Branded sign-in built into the founding journey — never the generic /login.
// Same Firebase flows as app/(auth)/login/page.tsx, restyled for the aurora.
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

export default function FoundingAuth({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function oauth(kind: 'google' | 'apple') {
    setError(''); setLoading(kind);
    const provider = kind === 'google' ? googleProvider : appleProvider;
    try {
      const res = await signInWithPopup(auth, provider);
      onAuthed(res.user);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') { await signInWithRedirect(auth, provider); return; }
      if (code !== 'auth/cancelled-popup-request' && code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
      setLoading(null);
    }
  }

  async function emailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading('email');
    try {
      const res = mode === 'signup'
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      onAuthed(res.user);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else if (code === 'auth/email-already-in-use') setError('You already have an account — sign in instead.');
      else if (code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else if (code === 'auth/invalid-email') setError('Enter a valid email address.');
      else setError('Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="space-y-2.5">
        <button onClick={() => oauth('google')} disabled={loading !== null}
          className="btn-glass w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text disabled:opacity-60">
          {loading === 'google'
            ? <span className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            : <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
          Continue with Google
        </button>
        <button onClick={() => oauth('apple')} disabled={loading !== null}
          className="btn-glass w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text disabled:opacity-60">
          {loading === 'apple'
            ? <span className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            : <svg className="w-4 h-4 fill-text shrink-0" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>}
          Continue with Apple
        </button>
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-muted/40 text-xs">or</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      <form onSubmit={emailSubmit} className="space-y-2.5">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required
          className="w-full bg-panel/60 backdrop-blur-md border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/50 transition-colors" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required minLength={6}
          className="w-full bg-panel/60 backdrop-blur-md border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/50 transition-colors" />
        <button type="submit" disabled={loading !== null}
          className="btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60">
          <span className="relative z-10">{loading === 'email' ? 'Please wait…' : mode === 'signup' ? 'Create my founding account' : 'Sign in'}</span>
        </button>
      </form>

      {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}

      <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
        className="w-full text-center text-xs text-muted/60 hover:text-muted transition-colors mt-4">
        {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </div>
  );
}
