'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { doc, setDoc, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';

const INDUSTRIES = ['Tech', 'Finance', 'Healthcare', 'Marketing & Media', 'Real Estate', 'Legal', 'Education', 'E-commerce', 'Consulting', 'Other'];
const FOCUS_AREAS = ['Growing my business', 'Career advancement', 'Health & performance', 'Financial freedom', 'Personal development', 'All of the above'];
const STYLES = [
  { key: 'normal', label: 'Direct & Blunt', desc: 'No fluff. Just facts and action.' },
  { key: 'formal', label: 'Strategic Advisor', desc: 'Big picture, sharp analysis.' },
  { key: 'learning', label: 'Sharp Coach', desc: 'Push me. Hold me accountable.' },
  { key: 'explanatory', label: 'Warm & Thoughtful', desc: 'Encouraging but honest.' },
];

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [challenge, setChallenge] = useState('');
  const [focus, setFocus] = useState('');
  const [goal, setGoal] = useState('');
  const [habits, setHabits] = useState(['']);
  const [tasks, setTasks] = useState(['']);
  const [style, setStyle] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (user) {
      setName(user.displayName || '');
      // Check if already onboarded
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.data()?.onboardingComplete) router.push('/dashboard');
      });
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const STEPS = [
    {
      title: "Let's build your Modus.",
      subtitle: 'Tell us who you are.',
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">Your name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First name"
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">Your role</label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Founder, VP of Sales, Freelance Designer"
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
        </div>
      ),
      valid: name.trim().length > 0 && role.trim().length > 0,
    },
    {
      title: 'What industry are you in?',
      subtitle: 'MODUS tailors its thinking to your world.',
      content: (
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRIES.map(ind => (
            <button
              key={ind}
              onClick={() => setIndustry(ind)}
              className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                industry === ind
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      ),
      valid: industry.length > 0,
    },
    {
      title: "What's your biggest professional challenge right now?",
      subtitle: 'Be specific. This becomes part of your core context.',
      content: (
        <textarea
          value={challenge}
          onChange={e => setChallenge(e.target.value)}
          placeholder="e.g. Scaling my team while keeping quality high. Managing 3 product lines with limited resources."
          rows={4}
          className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors resize-none"
        />
      ),
      valid: challenge.trim().length > 0,
    },
    {
      title: "What's your primary focus right now?",
      subtitle: 'Pick the one that matters most today.',
      content: (
        <div className="space-y-2">
          {FOCUS_AREAS.map(f => (
            <button
              key={f}
              onClick={() => setFocus(f)}
              className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                focus === f
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      ),
      valid: focus.length > 0,
    },
    {
      title: "What's your #1 goal this month?",
      subtitle: "One clear outcome. We'll track it.",
      content: (
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="e.g. Close 5 new clients. Ship the MVP. Hit $10k MRR."
          rows={3}
          className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors resize-none"
        />
      ),
      valid: goal.trim().length > 0,
    },
    {
      title: 'What habits are you building?',
      subtitle: "Add as many as you want. We'll track streaks.",
      content: (
        <div className="space-y-2">
          {habits.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={h}
                onChange={e => {
                  const next = [...habits];
                  next[i] = e.target.value;
                  setHabits(next);
                }}
                placeholder={`e.g. ${['30 min deep work', 'Morning workout', 'No phone before 9am', 'Read 20 pages'][i % 4]}`}
                className="flex-1 bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
              />
              {habits.length > 1 && (
                <button
                  onClick={() => setHabits(habits.filter((_, j) => j !== i))}
                  className="text-muted hover:text-red-400 transition-colors px-2"
                >✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setHabits([...habits, ''])}
            className="text-xs text-brand hover:underline"
          >+ Add another habit</button>
        </div>
      ),
      valid: habits.some(h => h.trim().length > 0),
    },
    {
      title: "What's on your plate this week?",
      subtitle: "Your active tasks. MODUS will help you get through them.",
      content: (
        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={t}
                onChange={e => {
                  const next = [...tasks];
                  next[i] = e.target.value;
                  setTasks(next);
                }}
                placeholder={`Task ${i + 1}`}
                className="flex-1 bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
              />
              {tasks.length > 1 && (
                <button
                  onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                  className="text-muted hover:text-red-400 transition-colors px-2"
                >✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setTasks([...tasks, ''])}
            className="text-xs text-brand hover:underline"
          >+ Add another task</button>
        </div>
      ),
      valid: tasks.some(t => t.trim().length > 0),
    },
    {
      title: 'How should MODUS talk to you?',
      subtitle: 'You can change this anytime in settings.',
      content: (
        <div className="space-y-2">
          {STYLES.map(s => (
            <button
              key={s.key}
              onClick={() => setStyle(s.key)}
              className={`w-full px-4 py-3.5 rounded-xl border transition-colors text-left ${
                style === s.key
                  ? 'border-brand bg-brand/10'
                  : 'border-border bg-panel hover:border-brand/40'
              }`}
            >
              <p className={`text-sm font-semibold ${style === s.key ? 'text-brand' : 'text-text'}`}>{s.label}</p>
              <p className="text-xs text-muted mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      ),
      valid: style.length > 0,
    },
  ];

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = async () => {
    if (!current.valid) return;
    if (!isLast) { setStep(s => s + 1); return; }

    setSaving(true);
    try {
      const uid = user.uid;

      // Update display name if changed
      if (name !== user.displayName) {
        await updateProfile(auth.currentUser!, { displayName: name });
      }

      // Build personal context string
      const personalContext = `My name is ${name}. I'm a ${role} in the ${industry} industry. My primary focus is ${focus}. My biggest professional challenge: ${challenge}`;

      // Save settings + mark onboarding complete
      await setDoc(doc(db, 'users', uid), {
        onboardingComplete: true,
        settings: {
          personalContext,
          responseStyle: style,
          capabilities: { dailyBriefing: false, voiceInput: false, vectorMemory: true },
          generateMemoryFromChat: true,
          helpImprove: false,
          dataRetention: true,
          customStyle: '',
        },
      }, { merge: true });

      // Create goal
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

      // Create habits
      for (const h of habits.filter(h => h.trim())) {
        await addDoc(collection(db, 'users', uid, 'habits'), {
          title: h.trim(),
          frequency: 'daily',
          streak: 0,
          completedDates: [],
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
      }

      // Create tasks
      for (const t of tasks.filter(t => t.trim())) {
        await addDoc(collection(db, 'users', uid, 'tasks'), {
          title: t.trim(),
          done: false,
          deleted: false,
          priority: 'medium',
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
      }

      // Save memories to Firestore + Pinecone
      const memories = [
        `My name is ${name} and I work as a ${role} in ${industry}.`,
        `My primary professional focus: ${focus}.`,
        `My biggest professional challenge: ${challenge}`,
        `My #1 goal this month: ${goal}`,
      ];

      const token = await user.getIdToken();
      for (const mem of memories) {
        await addDoc(collection(db, 'users', uid, 'memories'), {
          content: mem,
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
        // Upsert to Pinecone
        fetch('/api/memory/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: mem }),
        }).catch(() => {});
      }

      router.push('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg px-6">
      {/* Progress bar */}
      <div className="flex gap-1 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-brand' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-text mb-1">{current.title}</h1>
        <p className="text-sm text-muted mb-6">{current.subtitle}</p>
        {current.content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-sm text-muted hover:text-text transition-colors"
          >
            ← Back
          </button>
        ) : <div />}

        <button
          onClick={handleNext}
          disabled={!current.valid || saving}
          className="px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Setting up…' : isLast ? 'Launch my Modus →' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
