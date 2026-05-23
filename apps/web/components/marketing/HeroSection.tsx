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


/* ── Dashboard mockup ── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Glow behind the card */}
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(124,58,237,0.18),transparent)] blur-2xl pointer-events-none" />

      {/* Browser chrome */}
      <div className="relative bg-panel/80 dark:bg-panel/70 backdrop-blur-xl border border-border/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-bg/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-bg/60 border border-border/50 rounded-md px-3 py-1 text-[10px] text-muted/50 text-center">
              app.moduspilot.com
            </div>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="grid grid-cols-3 gap-0 min-h-[320px]">
          {/* Sidebar */}
          <div className="col-span-1 border-r border-border/40 p-4 space-y-1 bg-bg/20">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="w-5 h-5 rounded bg-brand/20 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand/60" />
              </div>
              <span className="text-[11px] font-black text-brand tracking-widest">MODUS</span>
            </div>
            {['Dashboard', 'Briefing', 'Goals', 'Habits', 'Tasks', 'Chat'].map((item, i) => (
              <div key={item} className={`px-2 py-1.5 rounded-lg text-[11px] flex items-center gap-2 ${i === 1 ? 'bg-brand/10 text-brand font-medium' : 'text-muted'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-brand' : 'bg-border'}`} />
                {item}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="col-span-2 p-5 space-y-4">
            {/* Briefing header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Morning Briefing</span>
                </div>
                <p className="text-sm font-bold text-text">Good morning. Here's your day.</p>
              </div>
              <div className="text-[10px] text-muted bg-bg/60 border border-border/50 rounded-lg px-2 py-1">
                Energy: 7/10
              </div>
            </div>

            {/* Top priorities */}
            <div className="space-y-2">
              {[
                { label: 'Finish homepage copy', priority: 'High', done: false },
                { label: 'Reply to investor email', priority: 'High', done: false },
                { label: 'Review Q2 goals', priority: 'Med', done: true },
              ].map((t, i) => (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[11px] ${t.done ? 'border-border/30 opacity-50' : 'border-border/60 bg-bg/30'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${t.done ? 'bg-brand border-brand' : 'border-border'}`}>
                    {t.done && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className={`flex-1 ${t.done ? 'line-through text-muted' : 'text-text'}`}>{t.label}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${t.priority === 'High' ? 'bg-brand/10 text-brand' : 'bg-border/60 text-muted'}`}>{t.priority}</span>
                </div>
              ))}
            </div>

            {/* Approval card */}
            <div className="border border-brand/30 bg-brand/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Approval Required</span>
              </div>
              <p className="text-[11px] text-muted mb-2">Block tomorrow 9–12 AM as deep work?</p>
              <div className="flex gap-2">
                <div className="flex-1 py-1 bg-brand rounded-lg text-white text-[10px] font-semibold text-center">Approve</div>
                <div className="flex-1 py-1 border border-border rounded-lg text-muted text-[10px] text-center">Edit</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ── */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-20 pb-16">

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {/* Base — light mode gets a rich violet tint, dark stays pure dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-100/70 via-violet-50/30 to-bg dark:from-violet-950/50 dark:via-bg dark:to-bg" />
        {/* Sweeping top gradient arc */}
        <div className="absolute top-0 left-0 right-0 h-[70%] bg-[radial-gradient(ellipse_100%_80%_at_50%_-10%,rgba(124,58,237,0.18),transparent_60%)] dark:bg-[radial-gradient(ellipse_100%_80%_at_50%_-10%,rgba(124,58,237,0.25),transparent_60%)]" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-orb hero-orb-4" />
        <ParticleCanvas />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(124,58,237,0.18)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* Animated spotlight sweep */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_50%_35%,rgba(124,58,237,0.12),transparent_70%)]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Text block */}
      <div className="relative max-w-3xl mx-auto text-center z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm text-brand text-xs font-semibold mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Early Access Open — 30 days free, no card needed
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.04] tracking-tight mb-6"
        >
          <span className="text-text">The AI That</span><br />
          <span className="hero-gradient-text">Runs Your Life.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          className="text-lg text-muted max-w-xl mx-auto mb-10 leading-relaxed"
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
            className="group relative px-8 py-4 bg-brand text-white text-base font-bold rounded-xl overflow-hidden transition-all hover:scale-[1.03] hover:shadow-[0_0_48px_rgba(124,58,237,0.55)] active:scale-100"
          >
            <span className="relative z-10">Start free — no credit card needed</span>
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-brand to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>
          <a href="#features" className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
            See how it works
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>↓</motion.span>
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted/60"
        >
          {['Gmail & Calendar connected', 'Use your own GPT-4o or Claude key', 'Privacy-first', 'Cancel anytime'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-brand/60">✓</span> {t}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Dashboard mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-4xl mx-auto z-10 px-2"
      >
        <DashboardMockup />
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent pointer-events-none z-20" />
    </section>
  );
}
