'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  doc, setDoc, addDoc, collection,
  getDoc, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── types ──────────────────────────────────────────────────────────────────────
type Screen = 'welcome' | 'name' | 'role' | 'goal' | 'google' | 'done';
const QUESTION_SCREENS: Screen[] = ['name', 'role', 'goal', 'google'];

// ── data ───────────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { icon: '🚀', label: 'Founder / builder',    desc: 'Running a startup or side project' },
  { icon: '💼', label: 'Executive / manager',   desc: 'Leading a team or organization' },
  { icon: '⚡', label: 'Professional',           desc: 'Employee, freelancer, or consultant' },
  { icon: '📚', label: 'Student',                desc: 'School, bootcamp, or self-study' },
  { icon: '🌐', label: 'Other',                  desc: '' },
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
    <div className="w-full max-w-md px-6 py-12 space-y-10">
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
            Your AI<br />chief of staff.
          </h1>
          <p className="text-sm text-muted mt-3 leading-relaxed max-w-xs mx-auto">
            Runs your inbox, calendar, and goals in the background — you just approve.
          </p>
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
        <p className="text-xs text-muted text-center">3-day free trial · No credit card required</p>
      </motion.div>
    </div>
  );
}

// ── NameScreen ─────────────────────────────────────────────────────────────────
function NameScreen({ name, setName, onNext }: {
  name: string; setName: (v: string) => void; onNext: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const preview  = name.trim()
    ? `${greeting}, ${name.trim()}. I'm MODUS. Let's get to work.`
    : `${greeting}. I'm MODUS. What are we working on today?`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md px-6 space-y-8"
    >
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">First things first</p>
        <h1 className="text-3xl font-black text-text leading-tight">What should MODUS<br />call you?</h1>
        <p className="text-sm text-muted mt-2">Your assistant needs a name for you.</p>
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

      <motion.button
        whileHover={name.trim() ? { scale: 1.02 } : {}}
        whileTap={name.trim() ? { scale: 0.97 } : {}}
        onClick={onNext}
        disabled={!name.trim()}
        className="w-full py-4 btn-primary text-white text-sm font-bold rounded-2xl disabled:opacity-40"
      >
        Continue →
      </motion.button>
    </motion.div>
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

// ── GoalStep ───────────────────────────────────────────────────────────────────
function GoalStep({ goal, setGoal }: { goal: string; setGoal: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">Your mission</p>
        <h1 className="text-2xl font-black text-text leading-tight">What do you want to accomplish in the next 30 days?</h1>
        <p className="text-sm text-muted mt-1.5">Be specific — MODUS will hold you to it.</p>
      </div>

      <textarea
        autoFocus
        value={goal}
        onChange={e => setGoal(e.target.value)}
        placeholder="e.g. Launch my first product and get 10 paying customers."
        rows={4}
        className="w-full bg-panel/70 border border-border/60 rounded-2xl px-5 py-4 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/60 transition-all resize-none"
      />

      <div className="bg-brand/6 border border-brand/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 mt-0.5">
          <Image src="/logo.png" alt="M" width={13} height={13} className="object-contain opacity-90" />
        </div>
        <p className="text-xs text-muted leading-relaxed">
          This becomes your first tracked goal. Daily briefings will reference your progress toward it.
        </p>
      </div>
    </div>
  );
}

// ── GoogleStep ─────────────────────────────────────────────────────────────────
function GoogleStep({ googleEmail, onConnect, connecting, error, onSkip }: {
  googleEmail: string; onConnect: () => void; connecting: boolean; error?: string; onSkip: () => void;
}) {
  const services = [
    { icon: '✉️', name: 'Gmail',    desc: 'Triage inbox, draft and send replies',     color: '#EA4335' },
    { icon: '📅', name: 'Calendar', desc: 'Manage schedule, block time, join meetings', color: '#4285F4' },
    { icon: '📁', name: 'Drive',    desc: 'Access docs for context in chat',            color: '#34A853' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-3">The core connection</p>
        <h1 className="text-2xl font-black text-text leading-tight">Connect Google to unlock your daily chief of staff.</h1>
        <p className="text-sm text-muted mt-1.5">This is what lets MODUS work in the background for you.</p>
      </div>

      <div className="space-y-2">
        {services.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              googleEmail ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/60 bg-panel/60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${s.color}18` }}>
              {s.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">{s.name}</p>
              <p className="text-xs text-muted">{s.desc}</p>
            </div>
            {googleEmail && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: i * 0.08 }}
                className="flex items-center gap-1.5"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-emerald-400">Connected</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {googleEmail ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/8 border border-emerald-500/25 rounded-2xl p-4 text-center space-y-1"
        >
          <p className="text-sm font-bold text-text">Connected as {googleEmail}</p>
          <p className="text-xs text-muted">Gmail, Calendar, and Drive are active</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onConnect}
            disabled={connecting}
            className="w-full py-3.5 bg-white text-gray-800 text-sm font-bold rounded-2xl border border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-60 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {connecting ? 'Connecting...' : 'Connect Google Account'}
          </motion.button>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <div className="flex items-start gap-2.5 bg-panel/60 border border-border/60 rounded-xl px-4 py-3">
            <span className="text-base shrink-0 mt-0.5">🔒</span>
            <p className="text-xs text-muted leading-relaxed">
              You may see an &ldquo;unverified app&rdquo; warning — verification is in progress. Click{' '}
              <span className="text-text font-medium">Advanced</span> →{' '}
              <span className="text-text font-medium">Go to Modus Pilot</span>.
            </p>
          </div>

          <button
            onClick={onSkip}
            className="w-full text-center text-xs text-muted/60 hover:text-muted transition-colors py-1"
          >
            Skip for now — connect later in Settings
          </button>
        </div>
      )}
    </div>
  );
}

// ── CompletionScreen ───────────────────────────────────────────────────────────
function CompletionScreen({ name, goal, googleEmail, onEnter }: {
  name: string; goal: string; googleEmail: string; onEnter: () => void;
}) {
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const items = [
    { check: true,  label: `Profile personalized${name.trim() ? ` for ${name.trim()}` : ''}` },
    ...(goal.trim() ? [{ check: true,  label: `Goal set: "${goal.trim().slice(0, 52)}${goal.trim().length > 52 ? '…' : ''}"` }] : []),
    { check: true,  label: 'Daily Review habit — streak starts today' },
    googleEmail
      ? { check: true,  label: 'Gmail, Calendar, Drive — active' }
      : { check: false, label: 'Connect Google in Settings to unlock your inbox' },
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
            <span className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">MODUS is live</span>
          </div>
          <h1 className="text-3xl font-black text-text leading-tight">
            {name.trim() ? `You're in, ${name.trim()}.` : "You're in."}
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
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.check ? 'bg-brand/20' : 'bg-border/30'}`}>
                {item.check ? (
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-brand">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-muted">
                    <path d="M2 6h8M6 2l4 4-4 4" />
                  </svg>
                )}
              </div>
              <p className={`text-sm leading-snug ${item.check ? 'text-text' : 'text-muted'}`}>{item.label}</p>
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
          {greeting}{name.trim() ? `, ${name.trim()}` : ''} — Open your dashboard →
        </motion.button>
        <p className="text-xs text-muted text-center">MODUS will scan your inbox and prepare today&apos;s briefing.</p>
      </motion.div>
    </motion.div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [screen,    setScreen]    = useState<Screen>('welcome');
  const [direction, setDirection] = useState(1);
  const [saving,    setSaving]    = useState(false);

  const [name,        setName]        = useState('');
  const [role,        setRole]        = useState('');
  const [goal,        setGoal]        = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [connecting,  setConnecting]  = useState(false);
  const [googleError, setGoogleError] = useState('');

  const [oauthConnectedEmail] = useState<string | null>(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('connected')
      : null
  );

  // Restore state after Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedEmail = params.get('connected');
    const oauthError     = params.get('error');
    if (!connectedEmail && !oauthError) return;

    const saved = sessionStorage.getItem('onboarding_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setName(s.name ?? '');
        setRole(s.role ?? '');
        setGoal(s.goal ?? '');
        sessionStorage.removeItem('onboarding_state');
      } catch {}
    }

    if (connectedEmail) {
      setGoogleEmail(decodeURIComponent(connectedEmail));
    } else if (oauthError) {
      setGoogleError('Connection failed. Please try again.');
    }
    window.history.replaceState({}, '', '/onboarding');
    setScreen('google');
  }, []);

  // Pre-populate Google email from Firestore
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'users', user.uid, 'google_accounts')).then(snap => {
      if (!snap.empty && !googleEmail) {
        setGoogleEmail((snap.docs[0].data() as { email: string }).email);
      }
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      if (oauthConnectedEmail) return;
      router.push('/login');
      return;
    }
    if (user && !oauthConnectedEmail) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.data()?.onboardingComplete) router.push('/dashboard');
      });
    }
  }, [user, loading, router, oauthConnectedEmail]);

  if (loading || (!user && !oauthConnectedEmail)) return null;

  function go(next: Screen, dir = 1) {
    setDirection(dir);
    setScreen(next);
  }

  async function handleConnectGoogle() {
    if (!user) return;
    setConnecting(true);
    try {
      sessionStorage.setItem('onboarding_state', JSON.stringify({ name, role, goal }));
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin: 'onboarding' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.url) throw new Error();
      window.location.href = data.url;
    } catch {
      sessionStorage.removeItem('onboarding_state');
      setGoogleError('Connection failed. Please try again.');
      setConnecting(false);
    }
  }

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    go('done');
    try {
      const uid        = user!.uid;
      const roleLabel  = role.trim() || 'Other';
      const personalContext = [
        name.trim() && `My name is ${name.trim()}.`,
        roleLabel   && `I am a ${roleLabel}.`,
        goal.trim() && `My 30-day goal: ${goal.trim()}.`,
      ].filter(Boolean).join(' ');

      await setDoc(doc(db, 'users', uid), {
        displayName: name.trim() || null,
        onboardingComplete: true,
        onboardingAnswers: { role: roleLabel, thirtyDayGoal: goal.trim() },
        settings: {
          personalContext,
          responseStyle: 'normal',
          capabilities: { dailyBriefing: false, voiceInput: false, vectorMemory: true },
          generateMemoryFromChat: true,
          helpImprove: false,
          dataRetention: true,
          customStyle: '',
        },
      }, { merge: true });

      if (goal.trim()) {
        await addDoc(collection(db, 'users', uid, 'goals'), {
          title: goal.trim(),
          description: '',
          status: 'active',
          progress: 0,
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
      }

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
        goal.trim() && `My 30-day goal: ${goal.trim()}.`,
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
  const NEXT: Partial<Record<Screen, Screen>> = { name: 'role', role: 'goal', goal: 'google' };
  const PREV: Partial<Record<Screen, Screen>> = { role: 'name', goal: 'role', google: 'goal' };
  const isValid: Record<Screen, boolean> = {
    welcome: true,
    name:    name.trim() !== '',
    role:    role !== '',
    goal:    goal.trim() !== '',
    google:  true,
    done:    true,
  };

  const stepIndex = QUESTION_SCREENS.indexOf(screen) + 1;

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

  // ── name ───────────────────────────────────────────────────────────────────
  if (screen === 'name') {
    return (
      <div className="relative min-h-screen flex flex-col">
        <div className="fixed top-4 right-4 z-50"><AnimatedThemeToggler /></div>
        <PageBackground />
        <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-8 pb-2">
          <div className="flex items-center justify-between">
            <DotProgress step={1} />
            <button onClick={() => go('welcome', -1)} className="text-sm text-muted hover:text-text transition-colors">← Back</button>
          </div>
        </div>
        <div className="relative z-10 flex-1 flex items-center justify-center py-8">
          <NameScreen name={name} setName={setName} onNext={() => name.trim() && go('role')} />
        </div>
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
            goal={goal}
            googleEmail={googleEmail}
            onEnter={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  // ── role / goal / google ───────────────────────────────────────────────────
  const isLast = screen === 'google';

  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="fixed top-4 right-4 z-50"><AnimatedThemeToggler /></div>
      <PageBackground />

      {/* Top bar */}
      <div className="relative z-10 w-full max-w-md px-6 pt-8 pb-2">
        <DotProgress step={stepIndex} />
      </div>

      {/* Step content */}
      <div className="relative z-10 w-full max-w-md flex-1 px-6 pt-6 pb-32">
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
            {screen === 'role'   && <RoleStep role={role} setRole={setRole} name={name} />}
            {screen === 'goal'   && <GoalStep goal={goal} setGoal={setGoal} />}
            {screen === 'google' && (
              <GoogleStep
                googleEmail={googleEmail}
                onConnect={handleConnectGoogle}
                connecting={connecting}
                error={googleError}
                onSkip={handleFinish}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center px-6 pb-8 pt-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
        <div className="w-full max-w-md flex items-center justify-between">
          <button
            onClick={() => go(PREV[screen] ?? 'welcome', -1)}
            className="text-sm text-muted hover:text-text transition-colors py-2 pr-4"
          >
            ← Back
          </button>

          <motion.button
            whileHover={isValid[screen] ? { scale: 1.03 } : {}}
            whileTap={isValid[screen] ? { scale: 0.97 } : {}}
            onClick={() => {
              if (isLast) {
                handleFinish();
              } else {
                const next = NEXT[screen];
                if (next && isValid[screen]) go(next);
              }
            }}
            disabled={!isValid[screen] || saving}
            className="px-7 py-3 btn-primary text-white text-sm font-bold rounded-2xl disabled:opacity-40 shadow-[0_2px_12px_rgba(124,58,237,0.28)]"
          >
            {isLast
              ? (googleEmail ? 'Launch MODUS →' : 'Continue without Google →')
              : 'Continue →'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
