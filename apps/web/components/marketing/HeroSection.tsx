'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/* ── Particle network canvas ── */
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
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.8 + 0.4,
        phase: Math.random() * Math.PI * 2,
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
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${a})`;
        ctx.fill();
        if (a > 0.45) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139,92,246,0.05)`;
          ctx.fill();
        }
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
            ctx.strokeStyle = `rgba(124,58,237,${(1 - d / LINK) * 0.18})`;
            ctx.lineWidth = 0.7;
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

/* ── Typewriter ── */
const PHRASES = [
  'builds your plan',
  'tracks your habits',
  'triages your inbox',
  'blocks your deep work',
  'tells you what to focus on',
];
function Typewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [erasing, setErasing] = useState(false);
  useEffect(() => {
    const phrase = PHRASES[idx];
    if (!erasing) {
      if (text.length < phrase.length) {
        const t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 52);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setErasing(true), 2000);
      return () => clearTimeout(t);
    }
    if (text.length > 0) {
      const t = setTimeout(() => setText(text.slice(0, -1)), 28);
      return () => clearTimeout(t);
    }
    setErasing(false);
    setIdx(i => (i + 1) % PHRASES.length);
  }, [text, erasing, idx]);
  return (
    <span className="text-brand font-semibold whitespace-nowrap">
      {text}
      <span className="inline-block w-0.5 h-[0.85em] bg-brand ml-0.5 animate-pulse align-middle rounded-full" />
    </span>
  );
}

/* ── Floating ambient UI cards ── */
function Float({ delay = 0, duration = 5, y = 12, children }: {
  delay?: number; duration?: number; y?: number; children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ y: [0, -y, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  );
}

const CARD_BASE = 'bg-panel/70 dark:bg-panel/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-xl shadow-black/10 pointer-events-none select-none';

function CardBriefing() {
  return (
    <Float duration={6} delay={0} y={10}>
      <div className={`${CARD_BASE} p-4 w-56`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Morning Briefing</span>
        </div>
        <p className="text-xs text-muted mb-2.5 leading-relaxed">Good morning. Here's your day.</p>
        <div className="space-y-1.5">
          {['🎯  3 priorities queued', '🔥  Streak at risk: Exercise', '📬  4 emails need replies'].map(t => (
            <div key={t} className="text-[11px] text-text/80 flex items-center gap-1.5">{t}</div>
          ))}
        </div>
        <div className="mt-3 h-px bg-border/50" />
        <p className="text-[10px] text-muted/60 mt-2">Energy: 7/10 · Focus window: 9–12 AM</p>
      </div>
    </Float>
  );
}

function CardApproval() {
  return (
    <Float duration={5} delay={1.2} y={14}>
      <div className={`${CARD_BASE} p-4 w-52`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Approval Required</span>
        </div>
        <div className="space-y-2 mb-3">
          {[
            'Draft reply to Marcus',
            'Block 9–12 AM deep work',
            'Move 3 PM → Friday',
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded border border-brand/40 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-sm bg-brand/60" />
              </div>
              <span className="text-[11px] text-text/80">{a}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 py-1 bg-brand rounded-lg text-white text-[10px] font-semibold text-center">Approve All</div>
          <div className="flex-1 py-1 border border-border rounded-lg text-muted text-[10px] text-center">Edit</div>
        </div>
      </div>
    </Float>
  );
}

function CardStreak() {
  return (
    <Float duration={7} delay={0.6} y={9}>
      <div className={`${CARD_BASE} p-4 w-48`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Habits Today</span>
          <span className="text-[10px] text-brand font-semibold">3/4 done</span>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Morning run', streak: 14, done: true },
            { label: 'Deep work', streak: 8, done: true },
            { label: 'Read 20 min', streak: 21, done: true },
            { label: 'Evening review', streak: 6, done: false },
          ].map(h => (
            <div key={h.label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${h.done ? 'bg-brand border-brand' : 'border-border'}`}>
                  {h.done && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className={`text-[11px] ${h.done ? 'text-text/60 line-through' : 'text-text/80'}`}>{h.label}</span>
              </div>
              <span className="text-[10px] text-brand/70">🔥{h.streak}</span>
            </div>
          ))}
        </div>
      </div>
    </Float>
  );
}

function CardGoal() {
  return (
    <Float duration={5.5} delay={2} y={11}>
      <div className={`${CARD_BASE} p-4 w-52`}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Active Goal</span>
        </div>
        <p className="text-xs font-semibold text-text mb-1">Launch MVP by June</p>
        <p className="text-[10px] text-muted mb-3">4 milestones · 12 tasks remaining</p>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-1.5">
          <motion.div
            className="h-full bg-gradient-to-r from-brand to-violet-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '68%' }}
            transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted">Progress</span>
          <span className="text-[10px] font-semibold text-brand">68%</span>
        </div>
      </div>
    </Float>
  );
}

/* ── Hero ── */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-16">

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 via-bg to-bg dark:from-bg dark:via-bg dark:to-bg" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-orb hero-orb-4" />
        <ParticleCanvas />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(124,58,237,0.15)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* Spotlight behind headline */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_42%,rgba(124,58,237,0.10),transparent_70%)]" />
      </div>

      {/* Floating ambient cards — hidden on mobile, visible md+ */}
      <div className="hidden lg:block">
        {/* Top-left */}
        <div className="absolute top-[18%] left-[4%] opacity-90">
          <CardBriefing />
        </div>
        {/* Top-right */}
        <div className="absolute top-[14%] right-[3%] opacity-85">
          <CardApproval />
        </div>
        {/* Bottom-left */}
        <div className="absolute bottom-[16%] left-[5%] opacity-80">
          <CardStreak />
        </div>
        {/* Bottom-right */}
        <div className="absolute bottom-[18%] right-[4%] opacity-85">
          <CardGoal />
        </div>
      </div>

      {/* Connecting beams from cards to center (subtle) */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-[18%] w-32 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent rotate-12" />
        <div className="absolute top-[28%] right-[18%] w-32 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent -rotate-12" />
        <div className="absolute bottom-[28%] left-[18%] w-24 h-px bg-gradient-to-r from-transparent via-brand/15 to-transparent -rotate-6" />
        <div className="absolute bottom-[30%] right-[18%] w-24 h-px bg-gradient-to-r from-transparent via-brand/15 to-transparent rotate-6" />
      </div>

      {/* Content */}
      <div className="relative max-w-3xl mx-auto text-center z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm text-brand text-xs font-semibold mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Early Access Open — 30 days free, no card needed
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.04] tracking-tight mb-6"
        >
          <span className="text-text">The AI That</span>
          <br />
          <span className="hero-gradient-text">Runs Your Life.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          className="text-lg text-muted max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Tell MODUS your goals. It <Typewriter /> — every morning.
          You approve every action. Nothing runs without you.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.34, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
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
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              ↓
            </motion.span>
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted/60"
        >
          {[
            'Gmail & Calendar connected',
            'Use your own GPT-4o or Claude key',
            'Privacy-first — your data stays yours',
            'Cancel anytime',
          ].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-brand/60">✓</span> {t}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
    </section>
  );
}
