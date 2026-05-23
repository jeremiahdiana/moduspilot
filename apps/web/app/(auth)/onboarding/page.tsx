'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import { doc, setDoc, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── data ────────────────────────────────────────────────────────────────────
const EMPLOYMENT_OPTIONS = [
  { icon: '💼', label: 'Employed full-time',           desc: 'Working 9 to 5 and beyond' },
  { icon: '⚡', label: 'Self-employed / freelancer',   desc: 'Running your own show' },
  { icon: '🕐', label: 'Employed part-time',           desc: 'Splitting your time' },
  { icon: '📚', label: 'Student',                       desc: 'Still in the learning phase' },
  { icon: '🔍', label: 'Between roles',                 desc: 'Looking for the next move' },
  { icon: '🌐', label: 'Other',                         desc: '' },
];
const INDUSTRY_OPTIONS = [
  { icon: '💻', label: 'Tech / software',     desc: '' },
  { icon: '🎨', label: 'Marketing / creative', desc: '' },
  { icon: '📈', label: 'Finance / business',   desc: '' },
  { icon: '🏥', label: 'Healthcare',           desc: '' },
  { icon: '📚', label: 'Education',            desc: '' },
  { icon: '🤝', label: 'Sales',                desc: '' },
  { icon: '⚙️', label: 'Trades / skilled labor', desc: '' },
  { icon: '🌐', label: 'Other',               desc: '' },
];
const GOALS_OPTIONS = [
  { icon: '🎯', label: 'Land a new job or role',                    desc: '' },
  { icon: '🚀', label: 'Build a business or side project',          desc: '' },
  { icon: '⏰', label: 'Get better at managing my time',            desc: '' },
  { icon: '⚡', label: 'Ship more / be more productive at work',    desc: '' },
  { icon: '🧠', label: 'Develop a new skill',                       desc: '' },
  { icon: '🧭', label: 'Figure out what I actually want to do',     desc: '' },
  { icon: '🌐', label: 'Other',                                      desc: '' },
];
const CHALLENGE_OPTIONS = [
  { icon: '🔄', label: "Know what to do but can't stay consistent", desc: '' },
  { icon: '🌊', label: "Overwhelmed and don't know where to start", desc: '' },
  { icon: '📱', label: 'Get distracted too easily',                  desc: '' },
  { icon: '💭', label: "Set goals but don't follow through",         desc: '' },
  { icon: '🗺️', label: "Don't have a clear plan",                   desc: '' },
  { icon: '🌐', label: 'Other',                                       desc: '' },
];
const TASK_OPTIONS = [
  { icon: '✅', label: 'I use a to-do app',                  desc: '' },
  { icon: '🧠', label: 'I keep it in my head',               desc: '' },
  { icon: '📝', label: 'I use a notes app',                  desc: '' },
  { icon: '📅', label: 'I use a calendar',                   desc: '' },
  { icon: '⚠️', label: 'I have a system but it breaks down', desc: '' },
  { icon: '🤷', label: "I don't really manage them",          desc: '' },
  { icon: '🌐', label: 'Other',                               desc: '' },
];

// ── animation variants ───────────────────────────────────────────────────────
const slideVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 48, filter: 'blur(4px)' }),
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit:    (dir: number) => ({ opacity: 0, x: dir * -48, filter: 'blur(4px)' }),
};
const slideTransition = { duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

const cardContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const cardItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

// ── background blobs ─────────────────────────────────────────────────────────
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        animate={{ x: [0, 28, -18, 0], y: [0, -38, 22, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand/7 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -22, 32, 0], y: [0, 28, -18, 0], scale: [1, 0.92, 1.12, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 18, -28, 0], y: [0, -18, 28, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 12 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/4 rounded-full blur-3xl"
      />
    </div>
  );
}

// ── icon card ────────────────────────────────────────────────────────────────
function IconCard({ icon, label, desc, selected, onClick, multi }: {
  icon: string; label: string; desc?: string; selected: boolean; onClick: () => void; multi?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.975 }}
      onClick={onClick}
      className={`relative w-full p-3.5 rounded-2xl border text-left transition-all duration-200 ${
        selected
          ? 'border-brand/60 bg-brand/8 shadow-[0_0_0_1px_rgba(124,58,237,0.15),0_4px_24px_rgba(124,58,237,0.1)]'
          : 'border-border/60 bg-panel/60 hover:border-brand/25 hover:bg-brand/4'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors ${
          selected ? 'bg-brand/18' : 'bg-bg/70'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-tight ${selected ? 'text-brand' : 'text-text'}`}>{label}</p>
          {desc && <p className="text-xs text-muted mt-0.5 leading-snug">{desc}</p>}
        </div>
        {multi ? (
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
            selected ? 'border-brand bg-brand' : 'border-muted/30 bg-transparent'
          }`}>
            {selected && (
              <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
        ) : (
          <motion.div
            animate={{ scale: selected ? 1 : 0.5, opacity: selected ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

// ── other textarea ───────────────────────────────────────────────────────────
function OtherTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe in your own words..."
        rows={2}
        className="w-full mt-2 bg-bg border border-dashed border-brand/40 rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/70 transition-colors resize-none"
      />
    </motion.div>
  );
}

// ── welcome screen ────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: '✉️', title: 'Emails, drafted and sent', desc: 'MODUS writes it, you approve it in one tap.' },
    { icon: '📅', title: 'Calendar, fully managed', desc: 'Schedule, block time, join meetings automatically.' },
    { icon: '🎯', title: 'Goals you actually hit', desc: 'Daily check-ins, nudges, and accountability built in.' },
    { icon: '🧠', title: 'Memory that persists', desc: 'MODUS remembers everything so you never repeat yourself.' },
  ];

  return (
    <div className="w-full max-w-md px-6 py-12 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-4"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-16 h-16 rounded-2xl bg-brand mx-auto flex items-center justify-center shadow-[0_8px_32px_rgba(124,58,237,0.35)]"
        >
          <Image src="/logo.png" alt="MODUS" width={36} height={36} className="object-contain" />
        </motion.div>
        <div>
          <p className="text-xs font-bold text-brand uppercase tracking-[0.18em] mb-3">Everything. One AI.</p>
          <h1 className="text-4xl font-black text-text leading-[1.08] tracking-tight">
            Your executive<br />assistant is ready.
          </h1>
          <p className="text-sm text-muted mt-3 max-w-xs mx-auto leading-relaxed">
            Email, calendar, goals, habits, memory — MODUS runs all of it so you can focus on what matters.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="bg-panel/70 border border-border/60 rounded-2xl p-5 space-y-4 backdrop-blur-sm"
      >
        <p className="text-xs text-muted uppercase tracking-wider font-semibold">One message does this</p>
        <div className="bg-brand/10 border border-brand/20 rounded-xl px-4 py-3 text-sm text-text font-medium italic">
          "Draft a reply to Marcus, block tomorrow morning, and send the invoice to Jamie."
        </div>
        <div className="space-y-2">
          {[
            'Email to Marcus — drafted, pending your approval',
            'Tomorrow morning blocked on your calendar',
            'Invoice sent to Jamie — confirmed',
          ].map((action, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.3 }}
              className="flex items-center gap-2.5 text-sm text-muted"
            >
              <div className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-brand">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              </div>
              {action}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 gap-3"
      >
        {features.map((f, i) => (
          <div key={i} className="bg-panel/60 border border-border/60 rounded-2xl p-4 space-y-2">
            <span className="text-2xl">{f.icon}</span>
            <p className="text-xs font-semibold text-text leading-snug">{f.title}</p>
            <p className="text-xs text-muted leading-snug">{f.desc}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3"
      >
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(124,58,237,0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full py-4 bg-brand text-white text-sm font-bold rounded-2xl transition-all shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
        >
          Start your free trial →
        </motion.button>
        <p className="text-xs text-muted text-center">30-day free trial · No credit card required</p>
      </motion.div>
    </div>
  );
}

// ── name screen ───────────────────────────────────────────────────────────────
function NameScreen({ name, setName, onNext }: { name: string; setName: (v: string) => void; onNext: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const preview = name.trim()
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
        transition={{ duration: 0.2 }}
        className="bg-panel/60 border border-border/60 rounded-2xl px-5 py-4 flex items-start gap-3"
      >
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 mt-0.5">
          <Image src="/logo.png" alt="M" width={14} height={14} className="object-contain opacity-90" />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Live preview</p>
          <p className="text-sm text-text leading-relaxed">"{preview}"</p>
        </div>
      </motion.div>
      <motion.button
        whileHover={name.trim() ? { scale: 1.02 } : {}}
        whileTap={name.trim() ? { scale: 0.97 } : {}}
        onClick={onNext}
        disabled={!name.trim()}
        className="w-full py-4 bg-brand text-white text-sm font-bold rounded-2xl hover:bg-brand/90 transition-all disabled:opacity-35 shadow-[0_4px_16px_rgba(124,58,237,0.2)]"
      >
        Continue →
      </motion.button>
    </motion.div>
  );
}

// ── google step ───────────────────────────────────────────────────────────────
function GoogleStep({ googleEmail, onConnect, connecting }: {
  googleEmail: string; onConnect: () => void; connecting: boolean;
}) {
  const services = [
    { icon: '✉️', name: 'Gmail', desc: 'Read inbox, draft and send emails', color: '#EA4335' },
    { icon: '📅', name: 'Calendar', desc: 'View and create events, manage schedule', color: '#4285F4' },
    { icon: '📁', name: 'Drive', desc: 'Access documents for context in chat', color: '#34A853' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {services.map(s => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              googleEmail
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-border/60 bg-panel/60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${s.color}18` }}>
              {s.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">{s.name}</p>
              <p className="text-xs text-muted">{s.desc}</p>
            </div>
            {googleEmail ? (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-green-400">Connected</span>
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-border/60" />
            )}
          </motion.div>
        ))}
      </div>

      {googleEmail ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-500/8 border border-green-500/25 rounded-2xl p-4 text-center space-y-1"
        >
          <p className="text-sm font-semibold text-text">Connected as {googleEmail}</p>
          <p className="text-xs text-muted">MODUS can now access your Gmail, Calendar, and Drive</p>
        </motion.div>
      ) : (
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
      )}
    </div>
  );
}

// ── daily review step ─────────────────────────────────────────────────────────
function DailyReviewStep({ name }: { name: string }) {
  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-brand/8 border border-brand/25 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center text-2xl shrink-0">
            🔁
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-text">Daily Review</p>
            <p className="text-xs text-muted">Every day · ~2 minutes</p>
          </div>
          <span className="text-xs font-semibold text-brand bg-brand/12 px-2.5 py-1 rounded-full border border-brand/20">
            Added for you
          </span>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Check in with MODUS each day. Review your goals, plan your day, and stay on track. The single habit that makes everything else work.
        </p>
        <div className="flex items-center gap-3 pt-1">
          {['Goals', 'Tasks', 'Priorities'].map((tag) => (
            <span key={tag} className="text-xs text-brand bg-brand/8 border border-brand/15 px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      <p className="text-xs text-muted text-center leading-relaxed">
        This habit will appear in your dashboard and tracked every day.
        {name.trim() ? ` You've got this, ${name.trim()}.` : ''}
      </p>

      <div className="bg-panel/60 border border-border/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 mt-0.5">
          <Image src="/logo.png" alt="M" width={13} height={13} className="object-contain opacity-90" />
        </div>
        <p className="text-xs text-muted leading-relaxed">
          "Consistency beats intensity. Show up every day for 2 minutes and MODUS will handle the rest."
        </p>
      </div>
    </div>
  );
}

// ── completion screen ─────────────────────────────────────────────────────────
function CompletionScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-md px-6 text-center space-y-6"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 16 }}
        className="w-20 h-20 rounded-3xl bg-brand mx-auto flex items-center justify-center shadow-[0_12px_40px_rgba(124,58,237,0.4)]"
      >
        <Image src="/logo.png" alt="MODUS" width={44} height={44} className="object-contain" />
      </motion.div>

      <div className="space-y-2">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-2xl font-black text-text"
        >
          MODUS is ready{name.trim() ? `, ${name.trim()}` : ''}.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-muted"
        >
          Setting up your workspace...
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="flex justify-center gap-1.5"
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-brand"
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState<'welcome' | 'name' | number | 'done'>('welcome');
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name,            setName]            = useState('');
  const [employment,      setEmployment]      = useState('');
  const [employmentOther, setEmploymentOther] = useState('');
  const [industry,        setIndustry]        = useState('');
  const [industryOther,   setIndustryOther]   = useState('');
  const [goals,           setGoals]           = useState<string[]>([]);
  const [goalsOther,      setGoalsOther]      = useState('');
  const [challenge,       setChallenge]       = useState('');
  const [challengeOther,  setChallengeOther]  = useState('');
  const [thirtyDayGoal,   setThirtyDayGoal]   = useState('');
  const [taskSystem,      setTaskSystem]      = useState('');
  const [taskSystemOther, setTaskSystemOther] = useState('');
  const [googleEmail,     setGoogleEmail]     = useState('');
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Handle return from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedEmail = params.get('connected');
    const oauthError = params.get('error');
    if (!connectedEmail && !oauthError) return;

    const saved = sessionStorage.getItem('onboarding_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setName(s.name ?? '');
        setEmployment(s.employment ?? '');
        setEmploymentOther(s.employmentOther ?? '');
        setIndustry(s.industry ?? '');
        setIndustryOther(s.industryOther ?? '');
        setGoals(s.goals ?? []);
        setGoalsOther(s.goalsOther ?? '');
        setChallenge(s.challenge ?? '');
        setChallengeOther(s.challengeOther ?? '');
        setThirtyDayGoal(s.thirtyDayGoal ?? '');
        setTaskSystem(s.taskSystem ?? '');
        setTaskSystemOther(s.taskSystemOther ?? '');
        sessionStorage.removeItem('onboarding_state');
      } catch {}
    }

    if (connectedEmail) setGoogleEmail(decodeURIComponent(connectedEmail));
    window.history.replaceState({}, '', '/onboarding');
    setScreen(7);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (user) {
      const params = new URLSearchParams(window.location.search);
      if (!params.get('connected') && !params.get('error')) {
        getDoc(doc(db, 'users', user.uid)).then(snap => {
          if (snap.data()?.onboardingComplete) router.push('/dashboard');
        });
      }
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  function go(next: 'welcome' | 'name' | number | 'done', dir = 1) {
    setDirection(dir);
    setScreen(next);
  }

  function toggleGoal(g: string) {
    setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function handleConnectGoogle() {
    setGoogleConnecting(true);
    sessionStorage.setItem('onboarding_state', JSON.stringify({
      name, employment, employmentOther, industry, industryOther,
      goals, goalsOther, challenge, challengeOther, thirtyDayGoal,
      taskSystem, taskSystemOther,
    }));
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/auth/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin: 'onboarding' }),
      });
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      sessionStorage.removeItem('onboarding_state');
      setGoogleConnecting(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    go('done');
    try {
      const uid = user!.uid;
      const empLabel  = employment === 'Other' ? employmentOther.trim()  : employment;
      const indLabel  = industry   === 'Other' ? industryOther.trim()    : industry;
      const goalsArr  = goals.map(g => g === 'Other' ? goalsOther.trim() : g);
      const chalLabel = challenge  === 'Other' ? challengeOther.trim()   : challenge;
      const taskLabel = taskSystem === 'Other' ? taskSystemOther.trim()  : taskSystem;

      const personalContext = [
        name.trim() && `My name is ${name.trim()}.`,
        empLabel && `Employment: ${empLabel}.`,
        indLabel && `Field: ${indLabel}.`,
        goalsArr.length && `Goals: ${goalsArr.join(', ')}.`,
        chalLabel && `Biggest challenge: ${chalLabel}.`,
        thirtyDayGoal.trim() && `30-day goal: ${thirtyDayGoal.trim()}.`,
        taskLabel && `Task system: ${taskLabel}.`,
      ].filter(Boolean).join(' ');

      await setDoc(doc(db, 'users', uid), {
        displayName: name.trim() || null,
        onboardingComplete: true,
        onboardingAnswers: { employment: empLabel, industry: indLabel, goals: goalsArr, challenge: chalLabel, thirtyDayGoal: thirtyDayGoal.trim(), taskSystem: taskLabel },
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

      // Create 30-day goal
      if (thirtyDayGoal.trim()) {
        await addDoc(collection(db, 'users', uid, 'goals'), {
          title: thirtyDayGoal.trim(),
          description: '',
          status: 'active',
          progress: 0,
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
      }

      // Seed Daily Review habit for every user
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

      // Save memories
      const memories = [
        name.trim()        && `My name is ${name.trim()}.`,
        empLabel           && `Employment: ${empLabel}. Field: ${indLabel}.`,
        goalsArr.length    && `What I'm working toward: ${goalsArr.join(', ')}.`,
        chalLabel          && `My biggest challenge: ${chalLabel}.`,
        thirtyDayGoal.trim() && `My 30-day goal: ${thirtyDayGoal.trim()}.`,
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

      setTimeout(() => router.push('/dashboard'), 1800);
    } finally {
      setSaving(false);
    }
  }

  // ── step config ────────────────────────────────────────────────────────────
  const TOTAL_STEPS = 8;

  const stepValid: Record<number, boolean> = {
    1: employment !== '' && (employment !== 'Other' || employmentOther.trim() !== ''),
    2: industry   !== '' && (industry   !== 'Other' || industryOther.trim()   !== ''),
    3: goals.length > 0  && (!goals.includes('Other') || goalsOther.trim()    !== ''),
    4: challenge  !== '' && (challenge  !== 'Other' || challengeOther.trim()  !== ''),
    5: thirtyDayGoal.trim() !== '',
    6: taskSystem !== '' && (taskSystem !== 'Other' || taskSystemOther.trim() !== ''),
    7: true, // Google connect is always skippable
    8: true, // Daily Review is always valid
  };

  const STEPS: Record<number, { label: string; title: string; subtitle?: string; content: React.ReactNode }> = {
    1: {
      label: `Step 1 of ${TOTAL_STEPS} · Who you are`,
      title: 'What best describes your current situation?',
      content: (
        <motion.div variants={cardContainerVariants} initial="hidden" animate="show" className="space-y-2">
          {EMPLOYMENT_OPTIONS.map(opt => (
            <motion.div key={opt.label} variants={cardItemVariants}>
              <IconCard icon={opt.icon} label={opt.label} desc={opt.desc} selected={employment === opt.label} onClick={() => setEmployment(opt.label)} />
              {opt.label === 'Other' && employment === 'Other' && <OtherTextarea value={employmentOther} onChange={setEmploymentOther} />}
            </motion.div>
          ))}
        </motion.div>
      ),
    },
    2: {
      label: `Step 2 of ${TOTAL_STEPS} · Work context`,
      title: 'What field are you in?',
      subtitle: '(or were in, if between roles)',
      content: (
        <motion.div variants={cardContainerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-2">
          {INDUSTRY_OPTIONS.map(opt => (
            <motion.div key={opt.label} variants={cardItemVariants} className={opt.label === 'Other' ? 'col-span-2' : ''}>
              <IconCard icon={opt.icon} label={opt.label} desc={opt.desc} selected={industry === opt.label} onClick={() => setIndustry(opt.label)} />
              {opt.label === 'Other' && industry === 'Other' && <OtherTextarea value={industryOther} onChange={setIndustryOther} />}
            </motion.div>
          ))}
        </motion.div>
      ),
    },
    3: {
      label: `Step 3 of ${TOTAL_STEPS} · Goals`,
      title: "What are we working on?",
      subtitle: 'Pick all that apply.',
      content: (
        <motion.div variants={cardContainerVariants} initial="hidden" animate="show" className="space-y-2">
          {GOALS_OPTIONS.map(opt => (
            <motion.div key={opt.label} variants={cardItemVariants}>
              <IconCard icon={opt.icon} label={opt.label} desc={opt.desc} selected={goals.includes(opt.label)} onClick={() => toggleGoal(opt.label)} multi />
              {opt.label === 'Other' && goals.includes('Other') && <OtherTextarea value={goalsOther} onChange={setGoalsOther} />}
            </motion.div>
          ))}
        </motion.div>
      ),
    },
    4: {
      label: `Step 4 of ${TOTAL_STEPS} · Biggest blocker`,
      title: "What's your biggest challenge right now?",
      content: (
        <motion.div variants={cardContainerVariants} initial="hidden" animate="show" className="space-y-2">
          {CHALLENGE_OPTIONS.map(opt => (
            <motion.div key={opt.label} variants={cardItemVariants}>
              <IconCard icon={opt.icon} label={opt.label} desc={opt.desc} selected={challenge === opt.label} onClick={() => setChallenge(opt.label)} />
              {opt.label === 'Other' && challenge === 'Other' && <OtherTextarea value={challengeOther} onChange={setChallengeOther} />}
            </motion.div>
          ))}
        </motion.div>
      ),
    },
    5: {
      label: `Step 5 of ${TOTAL_STEPS} · Right now`,
      title: "What's one thing you want to accomplish in the next 30 days?",
      content: (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={thirtyDayGoal}
            onChange={e => setThirtyDayGoal(e.target.value)}
            placeholder="Be specific — MODUS will hold you to it."
            rows={5}
            className="w-full bg-panel/70 border border-border/60 rounded-2xl px-5 py-4 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/60 transition-all resize-none"
          />
          <p className="text-xs text-muted px-1">This becomes your first tracked goal in MODUS.</p>
        </div>
      ),
    },
    6: {
      label: `Step 6 of ${TOTAL_STEPS} · How you operate`,
      title: 'How do you manage tasks today?',
      content: (
        <motion.div variants={cardContainerVariants} initial="hidden" animate="show" className="space-y-2">
          {TASK_OPTIONS.map(opt => (
            <motion.div key={opt.label} variants={cardItemVariants}>
              <IconCard icon={opt.icon} label={opt.label} desc={opt.desc} selected={taskSystem === opt.label} onClick={() => setTaskSystem(opt.label)} />
              {opt.label === 'Other' && taskSystem === 'Other' && <OtherTextarea value={taskSystemOther} onChange={setTaskSystemOther} />}
            </motion.div>
          ))}
        </motion.div>
      ),
    },
    7: {
      label: `Step 7 of ${TOTAL_STEPS} · Connect your world`,
      title: 'Give MODUS access to your Google',
      subtitle: 'One connection. Email, calendar, and Drive — all in sync.',
      content: (
        <GoogleStep
          googleEmail={googleEmail}
          onConnect={handleConnectGoogle}
          connecting={googleConnecting}
        />
      ),
    },
    8: {
      label: `Step 8 of ${TOTAL_STEPS} · Your first habit`,
      title: 'Start with one habit',
      subtitle: 'We\'ve picked the one habit that makes everything else work.',
      content: <DailyReviewStep name={name} />,
    },
  };

  // ── render screens ─────────────────────────────────────────────────────────
  if (screen === 'welcome') {
    return (
      <div className="relative min-h-screen flex flex-col items-center overflow-y-auto">
        <BackgroundBlobs />
        <div className="relative z-10">
          <WelcomeScreen onStart={() => go('name')} />
        </div>
      </div>
    );
  }

  if (screen === 'name') {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <BackgroundBlobs />
        <div className="relative z-10 w-full">
          <NameScreen name={name} setName={setName} onNext={() => name.trim() && go(1)} />
        </div>
      </div>
    );
  }

  if (screen === 'done') {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <BackgroundBlobs />
        <div className="relative z-10">
          <CompletionScreen name={name} />
        </div>
      </div>
    );
  }

  const stepNum = screen as number;
  const current = STEPS[stepNum];
  const isLast = stepNum === TOTAL_STEPS;
  const valid = stepValid[stepNum];

  const progressPct = (stepNum / TOTAL_STEPS) * 100;

  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <BackgroundBlobs />

      {/* Top bar */}
      <div className="relative z-10 w-full max-w-md px-6 pt-8 pb-2">
        {/* Progress bar */}
        <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted">{current.label}</p>
          <p className="text-xs text-muted">{Math.round(progressPct)}%</p>
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 w-full max-w-md flex-1 px-6 pt-6 pb-32">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepNum}
            custom={direction}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={slideTransition}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-black text-text leading-tight">{current.title}</h1>
              {current.subtitle && <p className="text-sm text-muted mt-1.5">{current.subtitle}</p>}
            </div>
            {current.content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav — fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center px-6 pb-8 pt-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
        <div className="w-full max-w-md flex items-center justify-between">
          <button
            onClick={() => go(stepNum === 1 ? 'name' : stepNum - 1, -1)}
            className="text-sm text-muted hover:text-text transition-colors py-2 pr-4"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {stepNum === 7 && !googleEmail && (
              <button
                onClick={() => go(8)}
                className="text-sm text-muted hover:text-text transition-colors py-2 px-2"
              >
                Skip
              </button>
            )}
            <motion.button
              whileHover={valid ? { scale: 1.03 } : {}}
              whileTap={valid ? { scale: 0.97 } : {}}
              onClick={isLast ? handleFinish : () => go(stepNum + 1)}
              disabled={!valid || saving}
              className="px-7 py-3 bg-brand text-white text-sm font-bold rounded-2xl hover:bg-brand/90 transition-all disabled:opacity-35 shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
            >
              {isLast ? 'Launch MODUS →' : 'Continue →'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
