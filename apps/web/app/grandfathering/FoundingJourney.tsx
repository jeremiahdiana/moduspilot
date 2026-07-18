'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { onAuthStateChanged, getIdToken, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { SCENES, type SceneProps } from './scenes';

interface Props { label: string; foundingNumber: number; cap: number; claimed: number }

// Per-scene hold time before auto-advancing (ms). The final scene (claim) never
// auto-advances — it waits for sign-in + payment.
const DURATIONS = [6000, 9500, 8500, 8000, 0];

export default function FoundingJourney({ label, foundingNumber, cap, claimed }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const last = SCENES.length - 1;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(last, n))), [last]);

  // Self-advancing (disabled on the final scene and under reduced-motion).
  useEffect(() => {
    if (reduce || i >= last || DURATIONS[i] === 0) return;
    const t = setTimeout(() => setI(v => Math.min(last, v + 1)), DURATIONS[i]);
    return () => clearTimeout(t);
  }, [i, last, reduce]);

  // Keyboard control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'Escape') router.push('/grandfathering');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go, router]);

  async function claim() {
    if (!user) return;
    setClaimError(''); setClaiming(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch('/api/founding/checkout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setClaimError(data.error || 'Could not open checkout. Try again.');
      setClaiming(false);
    } catch { setClaimError('Something went wrong. Try again.'); setClaiming(false); }
  }

  const Scene = SCENES[i];
  const sceneProps: SceneProps = {
    label, foundingNumber, cap, claimed,
    authed: !!user, onAuthed: setUser, onClaim: claim, claiming, claimError,
  };

  return (
    <>
      {/* progress segments */}
      <div className="fj-progress">
        {SCENES.map((_, idx) => (
          <button key={idx} onClick={() => go(idx)} className="fj-seg" aria-label={`Scene ${idx + 1}`}>
            {idx < i && <div className="fj-seg-fill" style={{ transform: 'scaleX(1)' }} />}
            {idx === i && (
              <motion.div className="fj-seg-fill"
                initial={{ scaleX: reduce || i === last ? 1 : 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: reduce || i === last ? 0 : DURATIONS[i] / 1000, ease: 'linear' }} />
            )}
          </button>
        ))}
      </div>

      {/* scene — scrolls when content is taller than the viewport, centers when it fits */}
      <div className="relative z-10 w-full flex-1 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-6 py-16">
          <AnimatePresence mode="wait">
            <motion.div key={i}
              initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex justify-center">
              <Scene {...sceneProps} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* controls */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-6 pb-8 max-w-2xl mx-auto w-full">
        <button onClick={() => (i === 0 ? router.push('/grandfathering') : go(i - 1))}
          className="text-xs text-muted/60 hover:text-muted transition-colors">
          {i === 0 ? '← Back' : '← Previous'}
        </button>
        <span className="text-[11px] text-muted/40 tabular-nums">{i + 1} / {SCENES.length}</span>
        {i < last ? (
          <div className="flex items-center gap-4">
            <button onClick={() => go(last)} className="text-xs text-muted/60 hover:text-muted transition-colors">Skip</button>
            <button onClick={() => go(i + 1)}
              className="btn-glass rounded-lg px-4 py-2 text-xs font-medium text-text">Next →</button>
          </div>
        ) : <span className="w-10" />}
      </div>
    </>
  );
}
