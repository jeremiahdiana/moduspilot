'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/* ── Particle canvas ── */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number; speed: number };
    let nodes: Node[] = [], raf: number;
    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.8 + 0.4, phase: Math.random() * Math.PI * 2,
        speed: 0.012 + Math.random() * 0.018,
      }));
    };
    init();
    window.addEventListener('resize', init);
    const LINK = 140;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy; n.phase += n.speed;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        const a = 0.3 + 0.25 * Math.sin(n.phase);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${a})`; ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(124,58,237,${(1 - d / LINK) * 0.18})`; ctx.lineWidth = 0.7; ctx.stroke();
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

/* ── Typewriter ── */
const PHRASES = ['builds your plan', 'tracks your habits', 'triages your inbox', 'blocks your deep work', 'tells you what to focus on'];
function Typewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [erasing, setErasing] = useState(false);
  useEffect(() => {
    const phrase = PHRASES[idx];
    if (!erasing) {
      if (text.length < phrase.length) { const t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 52); return () => clearTimeout(t); }
      const t = setTimeout(() => setErasing(true), 2000); return () => clearTimeout(t);
    }
    if (text.length > 0) { const t = setTimeout(() => setText(text.slice(0, -1)), 28); return () => clearTimeout(t); }
    setErasing(false); setIdx(i => (i + 1) % PHRASES.length);
  }, [text, erasing, idx]);
  return (
    <span className="text-brand font-semibold whitespace-nowrap">
      {text}<span className="inline-block w-0.5 h-[0.85em] bg-brand ml-0.5 animate-pulse align-middle rounded-full" />
    </span>
  );
}


/* ── Scrolling live activity ticker ── */
const TICKER = [
  '✅  Deep work blocked — 9 to 12 AM',
  '📬  4 emails triaged, 2 drafts queued',
  '🔥  Running streak: 14 days',
  '🎯  Milestone reached — Ship landing page',
  '✅  3 tasks approved by you',
  '📅  3 PM moved to Friday — approved',
  '💡  Pattern detected: energy dips after lunch',
  '🔥  Read 20 min — streak: 21 days',
  '✅  Weekly review ready for your approval',
  '📬  Reply sent to Marcus — approved',
];
function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden w-full max-w-3xl mx-auto mt-10">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="flex gap-4 whitespace-nowrap"
      >
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs text-muted/70 bg-panel/50 dark:bg-panel/40 backdrop-blur-sm border border-border/40 rounded-full px-3 py-1.5">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Dashboard product preview ── */
function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-5xl mx-auto mt-8 px-4 z-10"
    >
      {/* glow behind window */}
      <div className="absolute -inset-8 bg-[radial-gradient(ellipse_80%_50%_at_50%_60%,rgba(124,58,237,0.28),transparent)] pointer-events-none" />

      {/* browser chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-brand/25 shadow-[0_32px_80px_rgba(124,58,237,0.22)] bg-panel">
        {/* top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-bg border-b border-border/60">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-panel border border-border rounded-lg px-4 py-1 text-[11px] text-muted/60 font-mono">
              moduspilot.com/dashboard
            </div>
          </div>
        </div>

        {/* dashboard interior */}
        <div className="flex h-[340px] sm:h-[400px] overflow-hidden">
          {/* sidebar */}
          <div className="w-32 sm:w-40 border-r border-border bg-bg/60 flex flex-col py-4 px-2.5 gap-0.5 shrink-0">
            <div className="px-2 mb-3 flex items-center gap-1.5">
              <div className="w-5 h-5 bg-brand/20 rounded-md flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-brand/60 rounded-sm" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-brand">MODUS</span>
            </div>
            {['Dashboard', 'Briefing', 'Chat', 'Goals', 'Tasks', 'Habits'].map((label, i) => (
              <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-medium ${i === 0 ? 'bg-brand/10 text-brand' : 'text-muted'}`}>
                <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${i === 0 ? 'bg-brand/50' : 'bg-border'}`} />
                {label}
              </div>
            ))}
          </div>

          {/* main content */}
          <div className="flex-1 bg-bg p-4 overflow-hidden">
            {/* header */}
            <div className="mb-4">
              <div className="h-5 w-40 bg-text/10 rounded-md mb-1.5" />
              <div className="h-3 w-24 bg-muted/20 rounded mb-3" />
              <div className="flex gap-2 flex-wrap">
                <div className="h-6 w-24 bg-brand/10 border border-brand/25 rounded-full" />
                <div className="h-6 w-24 bg-yellow-500/10 border border-yellow-500/25 rounded-full" />
                <div className="h-6 w-28 bg-orange-500/10 border border-orange-500/25 rounded-full" />
              </div>
            </div>

            {/* focus card */}
            <div className="mb-4 px-4 py-3 rounded-xl bg-brand/8 border border-brand/20 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand/20 shrink-0" />
              <div>
                <div className="h-2 w-16 bg-brand/30 rounded mb-1.5" />
                <div className="h-3 w-36 sm:w-48 bg-text/15 rounded" />
              </div>
            </div>

            {/* widgets grid */}
            <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_130px] gap-3">
              <div className="space-y-3">
                <div className="bg-panel border border-border/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-4 h-4 bg-brand/10 rounded" />
                    <div className="h-3 w-28 bg-text/10 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full bg-muted/10 rounded" />
                    <div className="h-2.5 w-5/6 bg-muted/10 rounded" />
                    <div className="h-2.5 w-4/6 bg-muted/8 rounded" />
                  </div>
                </div>
                <div className="bg-panel border border-border/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-4 h-4 bg-brand/10 rounded" />
                    <div className="h-3 w-16 bg-text/10 rounded" />
                  </div>
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-border/60 shrink-0" />
                        <div>
                          <div className="h-2 w-20 sm:w-28 bg-text/10 rounded mb-1" />
                          <div className="h-1.5 w-16 sm:w-24 bg-muted/10 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-panel border border-border/60 rounded-xl p-3">
                  <div className="h-3 w-10 bg-text/10 rounded mb-2.5" />
                  {[65, 30].map((pct, i) => (
                    <div key={i} className="mb-2">
                      <div className="h-2 w-full bg-muted/10 rounded mb-1" />
                      <div className="h-1.5 w-full bg-border/50 rounded-full">
                        <div className="h-full bg-brand/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-panel border border-border/60 rounded-xl p-3">
                  <div className="h-3 w-10 bg-text/10 rounded mb-2.5" />
                  {[true, false, false].map((done, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1.5">
                      <div className={`w-3 h-3 rounded border shrink-0 ${done ? 'bg-brand border-brand' : 'border-border'}`} />
                      <div className={`h-2 rounded ${done ? 'w-14 bg-muted/10' : 'w-16 bg-text/10'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* caption */}
      <p className="text-center text-xs text-muted/50 mt-4">Your actual dashboard — goals, inbox, habits, calendar. All in one place.</p>
    </motion.div>
  );
}

/* ── Hero ── */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 pb-16">

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {/* Base — visible violet in light mode, deep dark in dark mode */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-300/70 via-violet-200/30 to-bg dark:from-violet-950/60 dark:via-bg dark:to-bg" />
        {/* Strong sweeping arc from top */}
        <div className="absolute top-0 left-0 right-0 h-[80%] bg-[radial-gradient(ellipse_120%_70%_at_50%_-5%,rgba(124,58,237,0.55),transparent_65%)] dark:bg-[radial-gradient(ellipse_120%_70%_at_50%_-5%,rgba(124,58,237,0.35),transparent_65%)]" />
        {/* Side accent blushes */}
        <div className="absolute top-0 left-0 w-1/2 h-full bg-[radial-gradient(ellipse_60%_50%_at_0%_30%,rgba(139,92,246,0.35),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_0%_30%,rgba(139,92,246,0.20),transparent)]" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_60%_50%_at_100%_30%,rgba(167,139,250,0.30),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_100%_30%,rgba(167,139,250,0.18),transparent)]" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-orb hero-orb-4" />
        <ParticleCanvas />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.22)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(124,58,237,0.18)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* Animated spotlight sweep */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_50%_35%,rgba(124,58,237,0.12),transparent_70%)]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Text block — w-full forces it to fill the flex container so text-center works correctly on mobile */}
      <div className="relative w-full max-w-3xl mx-auto text-center z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm text-brand text-[11px] font-semibold mb-8 max-w-full"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
          <span className="truncate">Early Access — 30 days free, no card needed</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.08] tracking-tight mb-6"
        >
          <span className="text-text">The AI That</span><br />
          <span className="hero-gradient-text">Runs Your Life.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          className="text-base sm:text-lg text-muted max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Tell MODUS your goals. It <Typewriter /> — every morning.
          You approve every action. Nothing runs without you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.34, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <a
            href="/login"
            className="btn-primary group relative w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-brand text-white text-sm sm:text-base font-bold rounded-xl transition-all hover:scale-[1.03] hover:shadow-[0_0_56px_rgba(124,58,237,0.60)] active:scale-100 text-center"
          >
            <span className="relative z-10">Start free — no credit card needed</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 via-brand to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>
          <a href="#features" className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
            See how it works
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>↓</motion.span>
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted/60"
        >
          {['Gmail & Calendar', 'GPT-5 powered', 'Privacy-first', 'Cancel anytime'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-brand/60">✓</span> {t}
            </span>
          ))}
        </motion.div>

        {/* Live ticker */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }}>
          <Ticker />
        </motion.div>
      </div>

      <DashboardPreview />

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent pointer-events-none z-20" />
    </section>
  );
}
