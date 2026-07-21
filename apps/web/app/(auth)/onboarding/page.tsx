'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { ClaudeLogo, OpenAILogo, GeminiLogo, MetaLogo } from '@/components/marketing/ModelLogos';
import { DemoWindow } from '@/components/marketing/ModelDemo';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  doc, setDoc, addDoc, collection,
  getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CADENCE_STORAGE_KEY, isCadence } from '@/lib/pricing';

// ── types ──────────────────────────────────────────────────────────────────────
type Screen = 'welcome' | 'name' | 'role' | 'models' | 'plan' | 'done';
const QUESTION_SCREENS: Screen[] = ['name', 'role', 'models', 'plan'];
type PlanId = 'modus' | 'pilot';

// ── data ───────────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { icon: '🚀', label: 'Founder / builder',    desc: 'Running a startup or side project' },
  { icon: '💼', label: 'Executive / manager',   desc: 'Leading a team or organization' },
  { icon: '⚡', label: 'Professional',           desc: 'Employee, freelancer, or consultant' },
  { icon: '📚', label: 'Student',                desc: 'School, bootcamp, or self-study' },
  { icon: '🌐', label: 'Other',                  desc: '' },
];

// Premium model brands MODUS routes between — brand names only (no versions), so
// nothing to keep updated. Reuses the shared marketing logo marks.
const BRAND_MODELS = [
  { name: 'ChatGPT', Logo: OpenAILogo },
  { name: 'Claude',  Logo: ClaudeLogo },
  { name: 'Gemini',  Logo: GeminiLogo },
  { name: 'Llama',   Logo: MetaLogo },
];

// ── animation helpers ──────────────────────────────────────────────────────────
const slideVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 40, filter: 'blur(4px)' }),
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit:    (dir: number) => ({ opacity: 0, x: dir * -40, filter: 'blur(4px)' }),
};
const slideTx = { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};

// ── PageBackground ─────────────────────────────────────────────────────────────
function PageBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-bg overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-bg to-bg dark:from-violet-950/40" />
      <div className="hero-orb hero-orb-1" style={{ opacity: 0.65 }} />
      <div className="hero-orb hero-orb-2" style={{ opacity: 0.42 }} />
      <div className="hero-orb hero-orb-3" style={{ opacity: 0.32 }} />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.07)_1px,transparent_1px)] bg-[size:28px_28px]" />
    </div>
  );
}

// ── DotProgress ────────────────────────────────────────────────────────────────
function DotProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {QUESTION_SCREENS.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i + 1 === step ? 20 : 6,
            backgroundColor: i + 1 <= step
              ? 'rgba(124,58,237,1)'
              : 'rgba(124,58,237,0.2)',
          }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ── WelcomeScreen ──────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const [visible, setVisible] = useState([false, false, false]);

  useEffect(() => {
    const t = [
      setTimeout(() => setVisible(v => [true,  v[1],  v[2]]),  900),
      setTimeout(() => setVisible(v => [v[0],  true,  v[2]]),  1400),
      setTimeout(() => setVisible(v => [v[0],  v[1],  true]),  1900),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full max-w-md px-6 py-12 space-y-8">
      {/* Logo + headline */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-5"
      >
        <div className="flex flex-col items-center gap-3">
          {/* Glowing logo */}
          <div className="relative">
            <div className="absolute inset-0 scale-[2.2] rounded-full bg-brand/12 blur-3xl" />
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-[76px] h-[76px] rounded-[22px] bg-gradient-to-br from-brand/25 to-brand/10 border border-brand/30 flex items-center justify-center shadow-[0_8px_36px_rgba(124,58,237,0.38)]"
            >
              <Image src="/logo.png"      alt="MODUS" width={44} height={33} className="object-contain block dark:hidden" />
              <Image src="/logo-dark.png" alt="MODUS" width={44} height={33} className="object-contain hidden dark:block" />
            </motion.div>
            {/* Pulse ring */}
            <motion.div
              animate={{ scale: [1, 1.75, 1], opacity: [0.35, 0, 0.35] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-[22px] border border-brand/40"
            />
          </div>

          <div>
            <h2 className="hero-gradient-text text-2xl font-black tracking-widest">MODUS</h2>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <motion.div
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
              <span className="text-xs text-emerald-400 font-semibold tracking-wide">Live and ready</span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-[2.6rem] font-black text-text leading-[1.05] tracking-tight">
            Every AI model.<br />One assistant.
          </h1>
          <p className="text-sm text-muted mt-3 leading-relaxed max-w-xs mx-auto">
            ChatGPT, Claude, Gemini and Llama in one place — routed to the best one for every task, and put to work running your day.
          </p>
        </div>

        {/* Every-model strip */}
        <div className="flex items-center justify-center gap-3">
          {BRAND_MODELS.map(({ name, Logo }) => (
            <div key={name} className="flex items-center gap-1.5">
              <Logo className="w-4 h-4" />
              <span className="text-[11px] font-semibold text-muted">{name}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Animated demo card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        className="bg-panel/70 border border-border/60 rounded-2xl p-5 space-y-4 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand/20 flex items-center justify-center shrink-0">
            <Image src="/logo.png" alt="" width={10} height={8} className="object-contain" />
          </div>
          <span className="text-xs text-muted font-medium">MODUS</span>
          <div className="ml-auto flex items-center gap-1">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="w-1 h-1 rounded-full bg-brand" />
            <span className="text-xs text-brand font-semibold">active</span>
          </div>
        </div>

        <div className="bg-brand/8 border border-brand/20 rounded-xl px-4 py-3 text-sm text-text/80 italic leading-relaxed">
          "Reply to Marcus, block tomorrow morning for deep work, send Jamie&apos;s invoice."
        </div>

        <div className="space-y-2.5">
          {[
            'Reply to Marcus — drafted, awaiting your approval',
            'Tomorrow 9–12 blocked on calendar',
            "Jamie's invoice — sent ✓",
          ].map((label, i) => (
            <motion.div
              key={i}
              animate={{ opacity: visible[i] ? 1 : 0.15, x: visible[i] ? 0 : -6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2.5 text-sm"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${visible[i] ? 'bg-brand/20' : 'bg-border/30'}`}>
                {visible[i] && (
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-brand">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <span className={visible[i] ? 'text-text/80' : 'text-muted/40'}>{label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full py-4 btn-primary text-white text-sm font-bold rounded-2xl shadow-[0_4px_24px_rgba(124,58,237,0.35)]"
        >
          Set up MODUS — takes 60 sec →
        </motion.button>
        <p className="text-xs text-muted text-center">3-day free trial · Card required · Cancel anytime</p>
      </motion.div>
    </div>
  );
}

// ── NameScreen ─────────────────────────────────────────────────────────────────
// Content only — the StepShell provides the width, progress, and Back/Continue nav.
function NameScreen({ name, setName, onNext }: {
  name: string; setName: (v: string) => void; onNext: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const preview  = name.trim()
    ? `${greeting}, ${name.trim()}. I'm MODUS. Let's get to work.`
    : `${greeting}. I'm MODUS. What are we working on today?`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">First things first</p>
        <h1 className="text-2xl font-black text-text leading-tight">What should MODUS call you?</h1>
        <p className="text-sm text-muted mt-1.5">Your assistant needs a name for you.</p>
      </div>

      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
        placeholder="Your first name"
        className="w-full bg-panel/70 border border-border/60 rounded-2xl px-5 py-4 text-base text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/60 focus:bg-panel transition-all"
      />

      <motion.div
        animate={{ opacity: name.trim() ? 1 : 0.35 }}
        className="bg-panel/60 border border-border/60 rounded-2xl px-5 py-4 flex items-start gap-3"
      >
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 mt-0.5">
          <Image src="/logo.png" alt="M" width={14} height={14} className="object-contain opacity-90" />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Preview</p>
          <p className="text-sm text-text leading-relaxed">&ldquo;{preview}&rdquo;</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── RoleStep ───────────────────────────────────────────────────────────────────
function RoleStep({ role, setRole, name }: { role: string; setRole: (v: string) => void; name: string }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">
          {name.trim() ? `Nice to meet you, ${name.trim()}.` : 'Quick profile'}
        </p>
        <h1 className="text-2xl font-black text-text leading-tight">What best describes you?</h1>
        <p className="text-sm text-muted mt-1.5">MODUS will personalize how it works for you.</p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
        {ROLE_OPTIONS.map(opt => (
          <motion.button
            key={opt.label}
            variants={fadeUp}
            whileHover={{ scale: 1.012 }}
            whileTap={{ scale: 0.975 }}
            onClick={() => setRole(opt.label)}
            className={`relative w-full p-3.5 rounded-2xl border text-left transition-all duration-200 overflow-hidden ${
              role === opt.label
                ? 'border-brand/60 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15),0_4px_20px_rgba(124,58,237,0.12)]'
                : 'border-border/60 bg-panel/60 hover:border-brand/25 hover:bg-brand/4'
            }`}
          >
            {role === opt.label && (
              <motion.div
                layoutId="role-glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-brand/10 to-transparent pointer-events-none"
              />
            )}
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors ${role === opt.label ? 'bg-brand/20' : 'bg-bg/70'}`}>
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${role === opt.label ? 'text-brand' : 'text-text'}`}>{opt.label}</p>
                {opt.desc && <p className="text-xs text-muted mt-0.5">{opt.desc}</p>}
              </div>
              <motion.div
                animate={{ scale: role === opt.label ? 1 : 0.5, opacity: role === opt.label ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              </motion.div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ── ModelsShowcaseScreen ─────────────────────────────────────────────────────────
// The multi-model "wow" slide — its OWN dedicated step, and the ONLY step that
// carries the live demo. Shows the real cycling reply (prompt → routed → a rich
// formatted answer: email/table/chart/image/code) so the differentiator lands.
function ModelsShowcaseScreen() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">Your unfair advantage</p>
        <h1 className="text-2xl md:text-[1.75rem] font-black text-text leading-tight">One subscription. Every model.</h1>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          ChatGPT, Claude, Gemini and Llama in one place — MODUS routes each task to whichever is best. Watch it work:
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {BRAND_MODELS.map(({ name, Logo: L }) => (
          <span key={name} className="inline-flex items-center gap-1.5 bg-panel/60 border border-border/60 rounded-full pl-2 pr-3 py-1.5">
            <L className="w-4 h-4" />
            <span className="text-xs font-semibold text-text">{name}</span>
          </span>
        ))}
      </div>

      {/* The real live demo — the whole point of this slide */}
      <DemoWindow showRail={false} compact />

      <p className="text-xs text-muted/70 text-center">
        Leave it on <span className="text-text font-medium">Auto</span> and MODUS picks per task, or switch models anytime in the composer.
      </p>
    </div>
  );
}

// ── PlanStep ───────────────────────────────────────────────────────────────────
// Lets the user pick which plan to start their 3-day trial on, before checkout.
const PLAN_OPTIONS: { id: PlanId; name: string; price: string; tagline: string; popular?: boolean; features: string[] }[] = [
  {
    id: 'modus', name: 'MODUS', price: '$24', tagline: 'Every provider, auto-routed',
    features: ['Claude + GPT-5.6 + Gemini, auto-routed', 'Inbox, calendar & goals', 'Daily briefing', 'Memory across every chat'],
  },
  {
    id: 'pilot', name: 'PILOT', price: '$59', tagline: 'Everything, higher limits', popular: true,
    features: ['Everything in MODUS', 'The frontier models — GPT-5.6 Sol, Claude Opus, Claude Fable 5 + Gemini 3.1 Pro', 'Much higher usage limits', 'Manual model pick per message'],
  },
];

function PlanStep({ selected, setSelected }: { selected: PlanId; setSelected: (v: PlanId) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">Pick your plan</p>
        <h1 className="text-2xl font-black text-text leading-tight">Choose your plan.</h1>
        <p className="text-sm text-muted mt-1.5">Both start with a 3-day free trial. Cancel anytime.</p>
      </div>

      <div className="space-y-3">
        {PLAN_OPTIONS.map(p => {
          const active = selected === p.id;
          return (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(p.id)}
              className={`relative w-full p-4 rounded-2xl border text-left transition-all duration-200 ${
                active
                  ? 'border-brand/60 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15),0_4px_20px_rgba(124,58,237,0.12)]'
                  : 'border-border/60 bg-panel/60 hover:border-brand/25'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black tracking-wide ${active ? 'text-brand' : 'text-text'}`}>{p.name}</span>
                    {p.popular && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-brand bg-brand/15 px-1.5 py-0.5 rounded-full">Popular</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{p.tagline}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-text">{p.price}</span>
                  <span className="text-xs text-muted">/mo</span>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${active ? 'border-brand bg-brand' : 'border-muted/40'}`}>
                  {active && (
                    <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {p.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`w-2.5 h-2.5 shrink-0 ${active ? 'text-brand' : 'text-muted'}`}>
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                    <span className="text-xs text-text/80">{f}</span>
                  </div>
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted/70 text-center leading-relaxed">
        You won&apos;t be charged today. Card required to start · cancel anytime before day 3.
      </p>
    </div>
  );
}

// ── CompletionScreen ───────────────────────────────────────────────────────────
function CompletionScreen({ name, planName, onEnter }: {
  name: string; planName: string; onEnter: () => void;
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const items = [
    { label: `Profile personalized${name.trim() ? ` for ${name.trim()}` : ''}` },
    { label: 'Every provider unlocked — ChatGPT, Claude, Gemini, Llama' },
    { label: 'Daily Review habit — streak starts today' },
  ];

  // 10 burst particles
  const particles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const dist  = 50 + (i % 3) * 14;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, brand: i % 2 === 0 };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-md px-6 space-y-8"
    >
      {/* Logo burst */}
      <div className="flex flex-col items-center gap-4 pt-6">
        <div className="relative flex items-center justify-center w-24 h-24">
          {particles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
              transition={{ delay: 0.15 + i * 0.04, duration: 0.55, ease: 'easeOut' }}
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: p.brand ? '#7c3aed' : '#a78bfa' }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand/25 to-brand/10 border border-brand/30 flex items-center justify-center shadow-[0_12px_48px_rgba(124,58,237,0.42)]"
          >
            <Image src="/logo.png"      alt="MODUS" width={48} height={36} className="object-contain block dark:hidden" />
            <Image src="/logo-dark.png" alt="MODUS" width={48} height={36} className="object-contain hidden dark:block" />
          </motion.div>

          {/* Glow ring flash */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.7, 1.7] }}
            transition={{ duration: 0.75, delay: 0.2 }}
            className="absolute inset-0 rounded-3xl border border-brand/50"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <motion.div animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">Ready to go</span>
          </div>
          <h1 className="text-3xl font-black text-text leading-tight">
            {name.trim() ? `You're set, ${name.trim()}.` : "You're set."}
          </h1>
          <p className="text-sm text-muted mt-1.5">{today}</p>
        </motion.div>
      </div>

      {/* Setup summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-panel/70 border border-border/60 rounded-2xl p-5 space-y-3 backdrop-blur-sm"
      >
        <p className="text-xs text-muted uppercase tracking-wider font-semibold">What was set up</p>
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.1 }}
              className="flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-brand/20">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-brand">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              </div>
              <p className="text-sm leading-snug text-text">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="space-y-2 pb-6"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onEnter}
          className="w-full py-4 btn-primary text-white text-sm font-bold rounded-2xl shadow-[0_4px_24px_rgba(124,58,237,0.35)]"
        >
          Start my 3-day {planName} trial →
        </motion.button>
        <p className="text-xs text-muted text-center">You won&apos;t be charged today · Cancel anytime</p>
      </motion.div>
    </motion.div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ?trial=1 = user bounced back from an abandoned checkout — jump them straight
  // to the plan/Start step instead of the onboardingComplete→dashboard redirect.
  const [trialMode] = useState<boolean>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('trial') === '1'
  );

  const [screen,    setScreen]    = useState<Screen>(trialMode ? 'plan' : 'welcome');
  const [direction, setDirection] = useState(1);
  const [saving,    setSaving]    = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('modus');

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    // Returning already-onboarded user (not in trial re-entry) → straight to app.
    if (user && !trialMode) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.data()?.onboardingComplete) router.push('/dashboard');
      });
    }
  }, [user, loading, router, trialMode]);

  if (loading || !user) return null;

  function go(next: Screen, dir = 1) {
    setDirection(dir);
    setScreen(next);
  }

  // New users start their 3-day card-required trial via Stripe Checkout for the
  // plan they picked. If checkout can't be created, fall through to the app — the
  // chat gate surfaces the paywall. Abandoning checkout returns to /onboarding?trial=1.
  async function startTrial() {
    try {
      const token = await user!.getIdToken();
      // Cadence was chosen back on /pricing and parked in localStorage, because
      // the /login hop can drop query params. Anything unrecognised bills
      // monthly — the server re-validates and falls back the same way.
      let cadence = 'monthly';
      try {
        const stored = window.localStorage.getItem(CADENCE_STORAGE_KEY);
        if (isCadence(stored)) cadence = stored;
      } catch { /* private mode */ }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: selectedPlan, returnTo: 'dashboard', cadence }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
    } catch { /* fall through to dashboard */ }
    router.push('/dashboard');
  }

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    go('done');
    try {
      const uid = user!.uid;
      // Idempotent: a trial re-entry (?trial=1) is already onboarded — don't
      // duplicate the seeded habit/memories.
      const existing = await getDoc(doc(db, 'users', uid));
      if (existing.data()?.onboardingComplete === true) return;

      const roleLabel = role.trim() || 'Other';
      const personalContext = [
        name.trim() && `My name is ${name.trim()}.`,
        roleLabel   && `I am a ${roleLabel}.`,
      ].filter(Boolean).join(' ');

      await setDoc(doc(db, 'users', uid), {
        displayName: name.trim() || null,
        onboardingComplete: true,
        onboardingAnswers: { role: roleLabel },
        settings: {
          personalContext,
          responseStyle: 'normal',
          // dailyBriefing is deliberately absent: CAPABILITY_DEFAULTS decides it.
          // Writing `false` here is what put every new account's Settings toggle
          // at OFF while the cron — which ignored the flag — delivered a briefing
          // every morning regardless.
          capabilities: { voiceInput: false, vectorMemory: true },
          generateMemoryFromChat: true,
          helpImprove: false,
          dataRetention: true,
          customStyle: '',
        },
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'habits'), {
        name: 'Daily Review',
        description: 'Check in with MODUS each day. Review your goals, plan your day, and stay on track.',
        frequency: 'daily',
        target: 1,
        color: '#7c3aed',
        icon: '🔁',
        completedDates: [],
        source: 'onboarding',
        createdAt: serverTimestamp(),
      });

      const memories = [
        name.trim() && `My name is ${name.trim()}.`,
        roleLabel   && `I am a ${roleLabel}.`,
      ].filter(Boolean) as string[];

      const token = await user!.getIdToken();
      for (const mem of memories) {
        await addDoc(collection(db, 'users', uid, 'memories'), {
          content: mem, source: 'onboarding', createdAt: serverTimestamp(),
        });
        fetch('/api/memory/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: mem }),
        }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  // Navigation maps
  const NEXT: Partial<Record<Screen, Screen>> = { name: 'role', role: 'models', models: 'plan' };
  const PREV: Partial<Record<Screen, Screen>> = { role: 'name', models: 'role', plan: 'models' };
  const isValid: Record<Screen, boolean> = {
    welcome: true,
    name:    name.trim() !== '',
    role:    role !== '',
    models:  true,
    plan:    true,
    done:    true,
  };

  const stepIndex = QUESTION_SCREENS.indexOf(screen) + 1;
  const selectedPlanName = PLAN_OPTIONS.find(p => p.id === selectedPlan)?.name ?? 'MODUS';

  // ── welcome ────────────────────────────────────────────────────────────────
  if (screen === 'welcome') {
    return (
      <div className="relative min-h-screen flex flex-col items-center overflow-y-auto">
        <div className="fixed top-4 right-4 z-50"><AnimatedThemeToggler /></div>
        <PageBackground />
        <div className="relative z-10"><WelcomeScreen onStart={() => go('name')} /></div>
      </div>
    );
  }

  // ── done ───────────────────────────────────────────────────────────────────
  if (screen === 'done') {
    return (
      <div className="relative min-h-screen flex flex-col items-center overflow-y-auto">
        <PageBackground />
        <div className="relative z-10 py-10">
          <CompletionScreen
            name={name}
            planName={selectedPlanName}
            onEnter={startTrial}
          />
        </div>
      </div>
    );
  }

  // ── name / role / models / plan — one centered, vertically-centered shell ────
  // Clean focused steps in a centered column. The live demo is NOT on every step;
  // it lives only on the 'models' slide (its own showcase), which widens to fit
  // it. Back/Continue sit in the same place at the bottom of the column on every
  // step, so the nav stays consistent even though the models slide is wider.
  const isLast = screen === 'plan';
  const isModels = screen === 'models';
  const handleNext = () => {
    if (isLast) { handleFinish(); return; }
    const next = NEXT[screen];
    if (next && isValid[screen]) go(next);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="fixed top-4 right-4 z-50"><AnimatedThemeToggler /></div>
      <PageBackground />

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-16 sm:py-20">
        <div className={`w-full mx-auto transition-[max-width] duration-300 ${isModels ? 'max-w-2xl' : 'max-w-lg'}`}>
          {/* Progress */}
          <div className="mb-8 flex justify-center">
            <DotProgress step={stepIndex} />
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={screen}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slideTx}
            >
              {screen === 'name'   && <NameScreen name={name} setName={setName} onNext={handleNext} />}
              {screen === 'role'   && <RoleStep role={role} setRole={setRole} name={name} />}
              {screen === 'models' && <ModelsShowcaseScreen />}
              {screen === 'plan'   && <PlanStep selected={selectedPlan} setSelected={setSelectedPlan} />}
            </motion.div>
          </AnimatePresence>

          {/* Nav — same position on every step */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => go(PREV[screen] ?? 'welcome', -1)}
              className="text-sm text-muted hover:text-text transition-colors py-2 pr-4"
            >
              ← Back
            </button>
            <motion.button
              whileHover={isValid[screen] ? { scale: 1.03 } : {}}
              whileTap={isValid[screen] ? { scale: 0.97 } : {}}
              onClick={handleNext}
              disabled={!isValid[screen] || saving}
              className="px-7 py-3 btn-primary text-white text-sm font-bold rounded-2xl disabled:opacity-40 shadow-[0_2px_12px_rgba(124,58,237,0.28)]"
            >
              {isLast ? 'Review & start →' : 'Continue →'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
