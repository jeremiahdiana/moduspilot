'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { onAuthStateChanged, getIdToken, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Props {
  label: string;
  foundingNumber: number;
  status: 'available' | 'claimed';
  claimed: number;
  cap: number;
}

const PERKS = [
  ['Every frontier model', 'Full PILOT tier — Opus, GPT, Gemini, Grok and more.'],
  ['$24/mo — locked for life', 'The founding rate never rises, even as prices do.'],
  ['Founder forever', 'You keep top-tier access as MODUS grows and plans change.'],
  ['A direct line to the founder', 'Talk to Jeremiah and help shape the roadmap.'],
  ['Early access to everything', 'You see and try new features before anyone else.'],
] as const;

function Check() {
  return (
    <span className="mt-0.5 inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-full bg-brand/15 text-brand">
      <svg viewBox="0 0 20 20" className="w-2.5 h-2.5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3.3-3.3a1 1 0 1 1 1.4-1.4l2.6 2.6 6.3-6.3a1 1 0 0 1 1.4 0Z" /></svg>
    </span>
  );
}

export default function FoundingOffer({ label, foundingNumber, status, claimed, cap }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);

  const spotsLeft = Math.max(0, cap - claimed);

  async function claim() {
    setError('');
    if (!user) {
      router.push('/login?next=/grandfathering');
      return;
    }
    setLoading(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch('/api/founding/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Could not start your claim. Try again.');
      setLoading(false);
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  // Already claimed — welcome them back in.
  if (status === 'claimed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="bg-panel/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand mb-4">
            Founding Member #{foundingNumber}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-text">Your spot is secured{label ? `, ${label}` : ''}.</h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">You’re one of the first {cap}. Full PILOT, $24/mo, locked for life.</p>
          <button
            onClick={() => router.push(authReady && user ? '/dashboard' : '/login')}
            className="btn-primary inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl text-white text-sm font-semibold"
          >
            <span className="relative z-10">Open MODUS</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative w-full max-w-md"
    >
      <div className="bg-panel/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand mb-4">
            Founding Member #{foundingNumber} of {cap}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-text text-balance">
            {label ? `${label}, you’re in.` : 'You’re in.'}
          </h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            A private invitation to the first {cap} members of MODUS — the AI operating system that runs your day.
          </p>
        </div>

        <ul className="mt-7 space-y-3">
          {PERKS.map(([title, desc]) => (
            <li key={title} className="flex gap-3">
              <Check />
              <div>
                <p className="text-sm font-medium text-text leading-snug">{title}</p>
                <p className="text-xs text-muted leading-snug">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={claim}
          disabled={loading}
          className="btn-primary w-full inline-flex items-center justify-center gap-2 mt-7 px-6 py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
        >
          <span className="relative z-10">{loading ? 'Starting…' : 'Claim your founding spot'}</span>
        </button>

        {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}

        <p className="text-center text-muted/60 text-[11px] mt-4">
          {spotsLeft > 0 ? `${spotsLeft} of ${cap} spots left` : 'All spots claimed'} · 3-day free trial · Cancel anytime
        </p>
      </div>
    </motion.div>
  );
}
