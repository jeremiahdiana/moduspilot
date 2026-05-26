'use client';

import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithRedirect, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import type { User } from 'firebase/auth';

/* ── Particle canvas (same system as hero) ── */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number; speed: number };
    let nodes: Node[] = [];
    let raf: number;

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 15000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.016,
      }));
    };
    init();
    window.addEventListener('resize', init);

    const LINK = 130;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy; n.phase += n.speed;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        const a = 0.28 + 0.22 * Math.sin(n.phase);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${a})`;
        ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(124,58,237,${(1 - d / LINK) * 0.16})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

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
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [checking, setChecking] = useState(true);

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

  async function signInWithGoogle() {
    setError(''); setLoading('google');
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
      setLoading(null);
    }
  }

  async function signInWithApple() {
    setError(''); setLoading('apple');
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

      {/* Full-screen animated background */}
      <div className="fixed inset-0 -z-10 bg-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-bg to-bg dark:from-violet-950/40" />
        <div className="hero-orb hero-orb-1" style={{ opacity: 0.7 }} />
        <div className="hero-orb hero-orb-2" style={{ opacity: 0.5 }} />
        <div className="hero-orb hero-orb-3" style={{ opacity: 0.4 }} />
        <ParticleCanvas />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* Center focus glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(124,58,237,0.08),transparent_70%)]" />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative w-full max-w-sm mx-6"
      >
        <div className="bg-panel/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl shadow-black/20">

          {/* Logo + wordmark */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/logo.png"
              alt="MODUS"
              width={72}
              height={54}
              className="object-contain block dark:hidden mb-3"
            />
            <Image
              src="/logo-dark.png"
              alt="MODUS"
              width={72}
              height={54}
              className="object-contain hidden dark:block mb-3"
            />
            <h1 className="hero-gradient-text text-3xl font-black tracking-widest">MODUS</h1>
            <p className="text-muted text-xs tracking-widest uppercase mt-1">pilot</p>
            <p className="text-muted/70 text-sm mt-3 text-center leading-relaxed">
              Your AI operating system.<br />Sign in to pick up where you left off.
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
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
              onClick={signInWithApple}
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-muted/40 text-xs">or</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full text-center text-muted/50 text-xs hover:text-muted transition-colors"
          >
            Back to moduspilot.com
          </button>
        </div>

        {/* Trust line below card */}
        <p className="text-center text-muted/40 text-xs mt-5">
          30-day free trial · No credit card · Cancel anytime
        </p>
      </motion.div>
    </>
  );
}
