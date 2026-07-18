'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

// The locked door: enter your personal founding key to reveal the offer.
export default function PasswordGate() {
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
      if (res.ok) {
        // Cookie is set — re-render the server page into the unlocked offer.
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'That key isn’t valid.');
      setLoading(false);
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative w-full max-w-sm"
    >
      <div className="bg-panel/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20 text-center">
        <p className="text-sm text-muted leading-relaxed mb-6">
          You’ve been invited to MODUS.<br />Enter your founding key to continue.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your founding key"
            autoFocus
            className="w-full bg-bg/60 border border-border rounded-xl px-4 py-3 text-sm text-text text-center tracking-wide placeholder:text-muted/40 focus:outline-none focus:border-brand/50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Unlocking…' : 'Enter'}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
        <p className="text-muted/40 text-[11px] mt-6">Invitation only · 100 spots</p>
      </div>
    </motion.div>
  );
}
