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
    // Only run the loop while the hero is actually on screen — stops the
    // O(n²) particle work from burning CPU when the user has scrolled past it.
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const io = new IntersectionObserver(
      ([entry]) => { entry.isIntersecting ? start() : stop(); },
      { threshold: 0 }
    );
    io.observe(canvas);
    start();
    return () => { stop(); window.removeEventListener('resize', init); io.disconnect(); };
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
          <span key={i} className="inline-flex items-center gap-2 text-xs text-muted/70 bg-panel/50 dark:bg-panel/40 border border-border/40 rounded-full px-3 py-1.5">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Hero ── */
export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={sectionRef} className={`relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 pb-16${onScreen ? '' : ' hero-paused'}`}>

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
          animate={onScreen ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.8 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Text block — w-full forces it to fill the flex container so text-center works correctly on mobile */}
      <div className="relative w-full max-w-3xl mx-auto text-center z-10 mb-12 pt-14">
        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold leading-[1.08] tracking-tight mb-6"
        >
          <span className="text-text">The AI That</span><br />
          <span className="hero-gradient-text">Runs Your Life.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          className="text-base sm:text-lg text-muted max-w-xl mx-auto mb-5 leading-relaxed"
        >
          Tell MODUS your goals. It <Typewriter /> — every morning.
          You approve every action. Nothing runs without you.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: 'easeOut' }}
          className="text-sm sm:text-base text-muted/90 max-w-xl mx-auto mb-2.5 leading-relaxed"
        >
          <span className="text-text font-semibold">Every model. Every app.</span> Routed to the best one — working while you don&apos;t.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.31, ease: 'easeOut' }}
          className="text-sm sm:text-base text-muted max-w-xl mx-auto mb-10"
        >
          Write with <span className="text-text font-semibold">Gemini</span>. Research with <span className="text-text font-semibold">Claude</span>. Ask <span className="text-text font-semibold">ChatGPT</span>.
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
            <span className="relative z-10">Start your 3-day free trial</span>
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
          {['Every frontier model', 'Gmail & Calendar', 'Web & Mac · iPhone beta', 'Cancel anytime'].map(t => (
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

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent pointer-events-none z-20" />
    </section>
  );
}
