'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import FoundingCard from '../grandfathering/FoundingCard';

// A one-time celebration burst — tasteful confetti, no external lib.
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const colors = ['#a78bfa', '#c084fc', '#818cf8', '#e879f9', '#fde68a', '#f5f3ff'];
    type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; life: number };
    const parts: P[] = [];
    const spawn = (n: number, ox: number) => {
      for (let i = 0; i < n; i++) parts.push({
        x: ox, y: canvas.height * 0.28,
        vx: (Math.random() - 0.5) * 9, vy: Math.random() * -11 - 4,
        r: Math.random() * 4 + 2, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        c: colors[(Math.random() * colors.length) | 0], life: 1,
      });
    };
    spawn(90, canvas.width * 0.5);
    setTimeout(() => spawn(50, canvas.width * 0.3), 220);
    setTimeout(() => spawn(50, canvas.width * 0.7), 380);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.006;
        if (p.life <= 0) continue;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
      if (parts.some(p => p.life > 0 && p.y < canvas.height + 40)) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 w-full h-full z-20" />;
}

export default function WelcomeSequence({ label, foundingNumber, cap }: { label: string; foundingNumber: number; cap: number }) {
  const router = useRouter();
  const num = String(foundingNumber).padStart(3, '0');

  return (
    <>
      <Confetti />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-[11px] tracking-[0.4em] uppercase text-violet-300 mb-6">
          Welcome to MODUS
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40, rotateY: 40, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
          className="w-full max-w-[340px] mb-9"
        >
          <FoundingCard label={label} foundingNumber={foundingNumber} cap={cap} />
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-text text-balance">
          You’re Founding Member No. {num}{label ? `, ${label}` : ''}.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}
          className="text-sm text-muted mt-3 leading-relaxed max-w-sm">
          One of the first {cap} people ever to run their life on MODUS. Your rate is locked for life, your access is the highest there is, and you have my direct line. Let’s build.
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="text-xs text-muted/60 mt-3 italic">— Jeremiah, founder of MODUS</motion.p>

        <motion.button initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35 }}
          onClick={() => router.push('/dashboard')}
          className="btn-primary mt-8 px-8 py-3.5 rounded-xl text-white text-sm font-semibold">
          <span className="relative z-10">Enter MODUS</span>
        </motion.button>
      </div>
    </>
  );
}
