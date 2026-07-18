'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import FoundingCard from './FoundingCard';

// The locked door, styled as a sealed invitation: your card is waiting, blurred,
// until your personal key unseals it.
export default function PasswordGate({ cap }: { cap: number }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/founding/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { router.refresh(); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'That key isn’t valid.');
      setLoading(false);
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center text-center">
      {/* wordmark */}
      <div className="flex flex-col items-center mb-8 fm-rise" style={{ animationDelay: '0.05s' }}>
        <Image src="/logo.png" alt="MODUS" width={56} height={42} className="object-contain block dark:hidden mb-2.5" priority />
        <Image src="/logo-dark.png" alt="MODUS" width={56} height={42} className="object-contain hidden dark:block mb-2.5" priority />
        <p className="text-muted text-[11px] tracking-[0.34em] uppercase">Founding Members</p>
      </div>

      {/* sealed card teaser */}
      <motion.div
        initial={{ opacity: 0, y: 22, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[320px] mb-9"
      >
        <div className="blur-[3px] opacity-70 pointer-events-none scale-[0.98]">
          <FoundingCard label="" foundingNumber={0} cap={cap} sealed />
        </div>
        {/* wax seal */}
        <div className="fm-seal fm-chip absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-violet-200" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
      </motion.div>

      {/* invitation + key entry */}
      <div className="w-full max-w-sm fm-rise" style={{ animationDelay: '0.2s' }}>
        <h1 className="text-2xl font-semibold tracking-tight text-text">You’ve been invited.</h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Enter your personal key to unseal your Founding Member card and claim your place among the first {cap}.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your founding key"
            autoFocus
            className="w-full bg-panel/70 backdrop-blur-md border border-border rounded-xl px-4 py-3.5 text-sm text-text text-center tracking-[0.18em] placeholder:tracking-normal placeholder:text-muted/40 focus:outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20 transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          >
            <span className="relative z-10">{loading ? 'Unsealing…' : 'Unseal my invitation'}</span>
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
        <p className="text-muted/40 text-[11px] mt-7 tracking-wide">By invitation only · {cap} founding seats</p>
      </div>
    </div>
  );
}
