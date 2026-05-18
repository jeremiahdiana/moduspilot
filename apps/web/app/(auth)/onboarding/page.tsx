'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { doc, setDoc, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── constants ──────────────────────────────────────────────────────────────
const EMPLOYMENT_OPTIONS = ['Employed full-time', 'Employed part-time', 'Self-employed / freelancer', 'Student', 'Unemployed / between roles', 'Other'];
const INDUSTRY_OPTIONS   = ['Tech / software', 'Marketing / creative', 'Finance / business', 'Healthcare', 'Education', 'Trades / skilled labor', 'Sales', 'Other'];
const GOALS_OPTIONS      = ['Land a new job or role', 'Build a business or side project', 'Get better at managing my time', 'Ship more / be more productive at work', 'Develop a new skill', 'Figure out what I actually want to do', 'Other'];
const CHALLENGE_OPTIONS  = ["I know what to do but I can't stay consistent", "I'm overwhelmed and don't know where to start", 'I get distracted too easily', "I set goals but don't follow through", "I don't have a clear plan", 'Other'];
const TASK_OPTIONS       = ['I use a to-do app', 'I keep it in my head', 'I use a notes app', 'I use a calendar', 'I have a system but it breaks down', "I don't really manage them", 'Other'];

const slide = {
  initial:  { opacity: 0, x: 40 },
  animate:  { opacity: 1, x: 0 },
  exit:     { opacity: 0, x: -40 },
  transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
};

const fadeUp = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

// ── subcomponents ──────────────────────────────────────────────────────────
function OtherTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }}>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe in your own words..."
        rows={2}
        className="w-full mt-2 bg-bg border border-dashed border-brand/50 rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand transition-colors resize-none"
      />
    </motion.div>
  );
}

function RadioOption({ label, selected, onClick, dashed }: { label: string; selected: boolean; onClick: () => void; dashed?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left ${
        selected
          ? 'border-brand bg-brand/10 text-brand'
          : dashed
          ? 'border-dashed border-border bg-panel text-muted hover:text-text hover:border-brand/40'
          : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
      }`}
    >
      {label}
    </motion.button>
  );
}

function MultiOption({ label, selected, onClick, dashed }: { label: string; selected: boolean; onClick: () => void; dashed?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left flex items-center gap-3 ${
        selected
          ? 'border-brand bg-brand/10 text-brand'
          : dashed
          ? 'border-dashed border-border bg-panel text-muted hover:text-text hover:border-brand/40'
          : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
      }`}
    >
      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
        selected ? 'border-brand bg-brand text-white' : 'border-muted/30'
      }`}>
        {selected ? '✓' : ''}
      </span>
      {label}
    </motion.button>
  );
}

// ── welcome screen ─────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full max-w-xl px-6 py-12 space-y-10">
      {/* Logo + pill */}
      <motion.div {...fadeUp} className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center mb-1">
          <span className="text-white text-xl font-black">M</span>
        </div>
        <span className="text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full tracking-wider uppercase">Everything. One AI.</span>
        <h1 className="text-3xl font-black text-text leading-tight">Your executive assistant<br />is ready.</h1>
        <p className="text-sm text-muted max-w-sm">Work, health, schedule, communication — MODUS connects to all of it and acts on your behalf.</p>
      </motion.div>

      {/* Example block */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, ...fadeUp.transition }} className="bg-panel border border-border rounded-2xl p-5 space-y-3">
        <p className="text-xs text-muted uppercase tracking-wider font-semibold">One conversation does this</p>
        <div className="bg-brand/10 border border-brand/20 rounded-xl px-4 py-3 text-sm text-text">
          "Draft a reply to Marcus, set a reminder for my 3 PM, block tomorrow morning, and send the invoice to Jamie."
        </div>
        <div className="space-y-2">
          {[
            'Email drafted to Marcus — ready for your approval',
            'Reminder set for 3 PM',
            'Tomorrow morning blocked',
            'Invoice sent to Jamie',
          ].map((action, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <span className="w-4 h-4 rounded-full bg-brand/20 text-brand flex items-center justify-center text-[10px]">✓</span>
              {action}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Capability cards */}
      <motion.div {...fadeUp} transition={{ delay: 0.2, ...fadeUp.transition }} className="grid grid-cols-1 gap-3">
        {[
          { icon: '✉', title: 'Emails, drafted and sent', desc: 'MODUS writes it, you approve it. One tap and it\'s gone.' },
          { icon: '⏰', title: 'Reminders, alarms & texts', desc: 'MODUS reaches out to you. Nothing slips, nothing gets forgotten.' },
          { icon: '⚡', title: 'Connected to your whole life', desc: 'Calendar, health, apps, devices — MODUS works across everything so you don\'t have to.' },
        ].map((card, i) => (
          <div key={i} className="flex items-start gap-4 bg-panel border border-border rounded-xl px-4 py-4">
            <span className="text-xl mt-0.5">{card.icon}</span>
            <div>
              <p className="text-sm font-semibold text-text">{card.title}</p>
              <p className="text-xs text-muted mt-0.5">{card.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Integration badges */}
      <motion.div {...fadeUp} transition={{ delay: 0.3, ...fadeUp.transition }} className="flex flex-wrap gap-2 justify-center">
        {['Calendar', 'Email', 'Watch', 'SMS', 'Whop', '+ More'].map(badge => (
          <span key={badge} className="text-xs text-muted bg-panel border border-border rounded-full px-3 py-1">{badge}</span>
        ))}
      </motion.div>

      {/* Pricing */}
      <motion.div {...fadeUp} transition={{ delay: 0.35, ...fadeUp.transition }} className="bg-panel border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Start free today</p>
            <p className="text-xs text-muted">No credit card needed to begin</p>
          </div>
          <span className="text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full">4-day free trial</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded-xl p-4">
            <p className="text-sm font-bold text-text">Modus</p>
            <p className="text-lg font-black text-text mt-1">$24<span className="text-xs font-normal text-muted">/mo</span></p>
            <p className="text-xs text-muted mt-1">Your own executive assistant</p>
          </div>
          <div className="border border-brand bg-brand/10 rounded-xl p-4 relative">
            <p className="text-sm font-bold text-brand">Pilot</p>
            <p className="text-lg font-black text-text mt-1">$99<span className="text-xs font-normal text-muted">/mo</span></p>
            <p className="text-xs text-muted mt-1">Fully replaces managers. It runs your day</p>
          </div>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div {...fadeUp} transition={{ delay: 0.4, ...fadeUp.transition }} className="flex flex-col items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="w-full py-4 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand/90 transition-colors"
        >
          Start your free trial →
        </motion.button>
        <p className="text-xs text-muted">4 days free. Cancel anytime.</p>
      </motion.div>
    </div>
  );
}

// ── name screen ────────────────────────────────────────────────────────────
function NameScreen({ name, setName, onNext }: { name: string; setName: (v: string) => void; onNext: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const preview = name.trim() ? `${greeting}, ${name.trim()}. I'm MODUS. Let's get to work.` : `${greeting}. I'm MODUS. Let's get to work.`;

  return (
    <motion.div {...slide} className="w-full max-w-lg px-6 space-y-8">
      <div>
        <p className="text-xs text-brand font-semibold uppercase tracking-widest mb-3">First things first</p>
        <h1 className="text-2xl font-black text-text mb-1">What should MODUS call you?</h1>
        <p className="text-sm text-muted">Your assistant needs a name for you.</p>
      </div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
        placeholder="Your first name"
        className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/60 transition-colors"
      />
      <motion.div
        animate={{ opacity: name.trim() ? 1 : 0.4 }}
        className="bg-panel border border-border rounded-xl px-5 py-4"
      >
        <p className="text-xs text-muted mb-1">Live preview</p>
        <p className="text-sm text-text font-medium italic">"{preview}"</p>
      </motion.div>
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        disabled={!name.trim()}
        className="w-full py-3 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
      >
        Continue →
      </motion.button>
    </motion.div>
  );
}

// ── completion screen ──────────────────────────────────────────────────────
function CompletionScreen({ name }: { name: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-lg px-6 text-center space-y-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-2xl bg-brand mx-auto flex items-center justify-center"
      >
        <span className="text-white text-2xl font-black">M</span>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-2xl font-black text-text">
        MODUS is setting up your workspace.
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-sm text-muted">
        Built around you{name.trim() ? `, ${name.trim()}` : ''}.
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex justify-center gap-1 pt-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-brand"
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // screen: 'welcome' | 'name' | 1..6 | 'done'
  const [screen, setScreen] = useState<'welcome' | 'name' | number | 'done'>('welcome');
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

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

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.data()?.onboardingComplete) router.push('/dashboard');
      });
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  function toggleGoal(g: string) {
    setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  const stepValid: Record<number, boolean> = {
    1: employment !== '' && (employment !== 'Other' || employmentOther.trim() !== ''),
    2: industry   !== '' && (industry   !== 'Other' || industryOther.trim()   !== ''),
    3: goals.length > 0  && (!goals.includes('Other') || goalsOther.trim()    !== ''),
    4: challenge  !== '' && (challenge  !== 'Other' || challengeOther.trim()  !== ''),
    5: thirtyDayGoal.trim() !== '',
    6: taskSystem !== '' && (taskSystem !== 'Other' || taskSystemOther.trim() !== ''),
  };

  function go(next: 'welcome' | 'name' | number | 'done', dir = 1) {
    setDirection(dir);
    setScreen(next);
  }

  async function handleFinish() {
    if (!stepValid[6]) return;
    setSaving(true);
    go('done');
    try {
      const uid = user!.uid;
      const empLabel  = employment === 'Other' ? employmentOther : employment;
      const indLabel  = industry   === 'Other' ? industryOther   : industry;
      const goalsArr  = goals.map(g => g === 'Other' ? goalsOther : g);
      const chalLabel = challenge  === 'Other' ? challengeOther  : challenge;
      const taskLabel = taskSystem === 'Other' ? taskSystemOther : taskSystem;

      const personalContext = `My name is ${name}. Employment: ${empLabel}. Field: ${indLabel}. Goals: ${goalsArr.join(', ')}. Biggest challenge: ${chalLabel}. 30-day goal: ${thirtyDayGoal}. Task system: ${taskLabel}.`;

      await setDoc(doc(db, 'users', uid), {
        onboardingComplete: true,
        onboardingAnswers: { employment: empLabel, industry: indLabel, goals: goalsArr, challenge: chalLabel, thirtyDayGoal, taskSystem: taskLabel },
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

      if (thirtyDayGoal.trim()) {
        await addDoc(collection(db, 'users', uid, 'goals'), {
          title: thirtyDayGoal.trim(), description: '', status: 'active', progress: 0, source: 'onboarding', createdAt: serverTimestamp(),
        });
      }

      const memories = [
        `My name is ${name}.`,
        `Employment: ${empLabel}. Field: ${indLabel}.`,
        `What I'm working toward: ${goalsArr.join(', ')}.`,
        `My biggest challenge: ${chalLabel}`,
        `My 30-day goal: ${thirtyDayGoal}`,
      ];
      const token = await user!.getIdToken();
      for (const mem of memories) {
        await addDoc(collection(db, 'users', uid, 'memories'), { content: mem, source: 'onboarding', createdAt: serverTimestamp() });
        fetch('/api/memory/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text: mem }) }).catch(() => {});
      }

      setTimeout(() => router.push('/dashboard'), 1800);
    } finally {
      setSaving(false);
    }
  }

  const slideVariants = {
    initial:  (dir: number) => ({ opacity: 0, x: dir * 50 }),
    animate:  { opacity: 1, x: 0 },
    exit:     (dir: number) => ({ opacity: 0, x: dir * -50 }),
  };

  if (screen === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col items-center overflow-y-auto">
        <WelcomeScreen onStart={() => go('name')} />
      </div>
    );
  }

  if (screen === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NameScreen name={name} setName={setName} onNext={() => name.trim() && go(1)} />
      </div>
    );
  }

  if (screen === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CompletionScreen name={name} />
      </div>
    );
  }

  const stepNum = screen as number;

  const STEPS: Record<number, { label: string; title: string; subtitle?: string; content: React.ReactNode }> = {
    1: {
      label: 'Step 1 of 6 · Who you are',
      title: 'What best describes your current employment situation?',
      content: (
        <div className="space-y-2">
          {EMPLOYMENT_OPTIONS.map(opt => (
            <div key={opt}>
              <RadioOption label={opt} selected={employment === opt} onClick={() => setEmployment(opt)} dashed={opt === 'Other'} />
              {opt === 'Other' && employment === 'Other' && <OtherTextarea value={employmentOther} onChange={setEmploymentOther} />}
            </div>
          ))}
        </div>
      ),
    },
    2: {
      label: 'Step 2 of 6 · Work context',
      title: 'What field are you in?',
      subtitle: '(or were in, if between roles)',
      content: (
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRY_OPTIONS.map(opt => (
            <div key={opt} className={opt === 'Other' ? 'col-span-2' : ''}>
              <RadioOption label={opt} selected={industry === opt} onClick={() => setIndustry(opt)} dashed={opt === 'Other'} />
              {opt === 'Other' && industry === 'Other' && <OtherTextarea value={industryOther} onChange={setIndustryOther} />}
            </div>
          ))}
        </div>
      ),
    },
    3: {
      label: 'Step 3 of 6 · Goals',
      title: "What are we working on?",
      subtitle: 'Pick all that apply.',
      content: (
        <div className="space-y-2">
          {GOALS_OPTIONS.map(opt => (
            <div key={opt}>
              <MultiOption label={opt} selected={goals.includes(opt)} onClick={() => toggleGoal(opt)} dashed={opt === 'Other'} />
              {opt === 'Other' && goals.includes('Other') && <OtherTextarea value={goalsOther} onChange={setGoalsOther} />}
            </div>
          ))}
        </div>
      ),
    },
    4: {
      label: 'Step 4 of 6 · Biggest blocker',
      title: "What's your biggest challenge right now?",
      content: (
        <div className="space-y-2">
          {CHALLENGE_OPTIONS.map(opt => (
            <div key={opt}>
              <RadioOption label={opt} selected={challenge === opt} onClick={() => setChallenge(opt)} dashed={opt === 'Other'} />
              {opt === 'Other' && challenge === 'Other' && <OtherTextarea value={challengeOther} onChange={setChallengeOther} />}
            </div>
          ))}
        </div>
      ),
    },
    5: {
      label: 'Step 5 of 6 · Right now',
      title: "What's one thing you want to accomplish in the next 30 days?",
      content: (
        <textarea
          autoFocus
          value={thirtyDayGoal}
          onChange={e => setThirtyDayGoal(e.target.value)}
          placeholder="Be specific. MODUS will hold you to it."
          rows={5}
          className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-brand/60 transition-colors resize-none"
        />
      ),
    },
    6: {
      label: 'Step 6 of 6 · How you operate',
      title: 'How do you manage tasks today?',
      content: (
        <div className="space-y-2">
          {TASK_OPTIONS.map(opt => (
            <div key={opt}>
              <RadioOption label={opt} selected={taskSystem === opt} onClick={() => setTaskSystem(opt)} dashed={opt === 'Other'} />
              {opt === 'Other' && taskSystem === 'Other' && <OtherTextarea value={taskSystemOther} onChange={setTaskSystemOther} />}
            </div>
          ))}
        </div>
      ),
    },
  };

  const current = STEPS[stepNum];
  const isLast = stepNum === 6;
  const valid = stepValid[stepNum];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-10 pb-20 px-6">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-2">
        <div className="flex gap-1">
          {[1,2,3,4,5,6].map(i => (
            <motion.div
              key={i}
              className="h-0.5 flex-1 rounded-full bg-border overflow-hidden"
            >
              <motion.div
                className="h-full bg-brand rounded-full"
                initial={{ width: 0 }}
                animate={{ width: i <= stepNum ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">{current.label}</p>
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepNum}
            custom={direction}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-black text-text mb-1">{current.title}</h1>
              {current.subtitle && <p className="text-sm text-muted">{current.subtitle}</p>}
            </div>
            {current.content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-lg mt-8 flex items-center justify-between">
        <button
          onClick={() => go(stepNum === 1 ? 'name' : stepNum - 1, -1)}
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Back
        </button>
        <motion.button
          whileHover={valid ? { scale: 1.02 } : {}}
          whileTap={valid ? { scale: 0.98 } : {}}
          onClick={isLast ? handleFinish : () => go(stepNum + 1)}
          disabled={!valid || saving}
          className="px-6 py-2.5 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {isLast ? 'Launch my Modus →' : 'Continue →'}
        </motion.button>
      </div>
    </div>
  );
}
