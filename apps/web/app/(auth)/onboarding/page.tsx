'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { doc, setDoc, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const EMPLOYMENT_OPTIONS = [
  'Employed full-time',
  'Employed part-time',
  'Self-employed / freelancer',
  'Student',
  'Unemployed / between roles',
  'Other',
];

const INDUSTRY_OPTIONS = [
  'Tech / software',
  'Marketing / creative',
  'Finance / business',
  'Healthcare',
  'Education',
  'Trades / skilled labor',
  'Sales',
  'Other',
];

const GOALS_OPTIONS = [
  'Land a new job or role',
  'Build a business or side project',
  'Get better at managing my time',
  'Ship more / be more productive at work',
  'Develop a new skill',
  'Figure out what I actually want to do',
  'Other',
];

const CHALLENGE_OPTIONS = [
  'I know what to do but I can\'t stay consistent',
  'I\'m overwhelmed and don\'t know where to start',
  'I get distracted too easily',
  'I set goals but don\'t follow through',
  'I don\'t have a clear plan',
  'Other',
];

const TASK_OPTIONS = [
  'I use a to-do app',
  'I keep it in my head',
  'I use a notes app',
  'I use a calendar',
  'I have a system but it breaks down',
  'I don\'t really manage them',
  'Other',
];

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [employment, setEmployment] = useState('');
  const [employmentOther, setEmploymentOther] = useState('');
  const [industry, setIndustry] = useState('');
  const [industryOther, setIndustryOther] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalsOther, setGoalsOther] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeOther, setChallengeOther] = useState('');
  const [thirtyDayGoal, setThirtyDayGoal] = useState('');
  const [taskSystem, setTaskSystem] = useState('');
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

  const TOTAL_STEPS = 6;

  function toggleGoal(g: string) {
    setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  const stepValid = [
    employment !== '' && (employment !== 'Other' || employmentOther.trim() !== ''),
    industry !== '' && (industry !== 'Other' || industryOther.trim() !== ''),
    goals.length > 0 && (!goals.includes('Other') || goalsOther.trim() !== ''),
    challenge !== '' && (challenge !== 'Other' || challengeOther.trim() !== ''),
    thirtyDayGoal.trim() !== '',
    taskSystem !== '' && (taskSystem !== 'Other' || taskSystemOther.trim() !== ''),
  ];

  const OtherTextarea = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Describe in your own words..."
      rows={2}
      className="w-full mt-2 bg-panel border border-brand/40 rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/70 transition-colors resize-none"
    />
  );

  const steps = [
    {
      title: "What's your employment status?",
      content: (
        <div className="space-y-2">
          {EMPLOYMENT_OPTIONS.map(opt => (
            <div key={opt}>
              <button
                onClick={() => setEmployment(opt)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                  employment === opt
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
                }`}
              >
                {opt}
              </button>
              {opt === 'Other' && employment === 'Other' && (
                <OtherTextarea value={employmentOther} onChange={setEmploymentOther} />
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'What field are you in?',
      subtitle: '(or were in, if between roles)',
      content: (
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRY_OPTIONS.map(opt => (
            <div key={opt} className={opt === 'Other' ? 'col-span-2' : ''}>
              <button
                onClick={() => setIndustry(opt)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                  industry === opt
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
                }`}
              >
                {opt}
              </button>
              {opt === 'Other' && industry === 'Other' && (
                <OtherTextarea value={industryOther} onChange={setIndustryOther} />
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "What are you working toward?",
      subtitle: 'Select all that apply.',
      content: (
        <div className="space-y-2">
          {GOALS_OPTIONS.map(opt => (
            <div key={opt}>
              <button
                onClick={() => toggleGoal(opt)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left flex items-center gap-3 ${
                  goals.includes(opt)
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs ${
                  goals.includes(opt) ? 'border-brand bg-brand text-white' : 'border-muted/40'
                }`}>
                  {goals.includes(opt) ? '✓' : ''}
                </span>
                {opt}
              </button>
              {opt === 'Other' && goals.includes('Other') && (
                <OtherTextarea value={goalsOther} onChange={setGoalsOther} />
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "What's your biggest challenge right now?",
      content: (
        <div className="space-y-2">
          {CHALLENGE_OPTIONS.map(opt => (
            <div key={opt}>
              <button
                onClick={() => setChallenge(opt)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                  challenge === opt
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
                }`}
              >
                {opt}
              </button>
              {opt === 'Other' && challenge === 'Other' && (
                <OtherTextarea value={challengeOther} onChange={setChallengeOther} />
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "What's one thing you want to accomplish in the next 30 days?",
      content: (
        <textarea
          value={thirtyDayGoal}
          onChange={e => setThirtyDayGoal(e.target.value)}
          placeholder="Be specific — the clearer the better."
          rows={4}
          className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors resize-none"
        />
      ),
    },
    {
      title: 'How do you manage tasks today?',
      content: (
        <div className="space-y-2">
          {TASK_OPTIONS.map(opt => (
            <div key={opt}>
              <button
                onClick={() => setTaskSystem(opt)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                  taskSystem === opt
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-panel text-muted hover:text-text hover:border-brand/40'
                }`}
              >
                {opt}
              </button>
              {opt === 'Other' && taskSystem === 'Other' && (
                <OtherTextarea value={taskSystemOther} onChange={setTaskSystemOther} />
              )}
            </div>
          ))}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === TOTAL_STEPS - 1;

  const handleNext = async () => {
    if (!stepValid[step]) return;
    if (!isLast) { setStep(s => s + 1); return; }

    setSaving(true);
    try {
      const uid = user.uid;

      const employmentLabel = employment === 'Other' ? employmentOther : employment;
      const industryLabel = industry === 'Other' ? industryOther : industry;
      const goalsLabel = goals.map(g => g === 'Other' ? goalsOther : g).join(', ');
      const challengeLabel = challenge === 'Other' ? challengeOther : challenge;
      const taskLabel = taskSystem === 'Other' ? taskSystemOther : taskSystem;

      const personalContext = `Employment: ${employmentLabel}. Field: ${industryLabel}. Goals: ${goalsLabel}. Biggest challenge: ${challengeLabel}. 30-day goal: ${thirtyDayGoal}. Task management: ${taskLabel}.`;

      await setDoc(doc(db, 'users', uid), {
        onboardingComplete: true,
        onboardingAnswers: {
          employment: employmentLabel,
          industry: industryLabel,
          goals: goals.map(g => g === 'Other' ? goalsOther : g),
          challenge: challengeLabel,
          thirtyDayGoal,
          taskSystem: taskLabel,
        },
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
          title: thirtyDayGoal.trim(),
          description: '',
          status: 'active',
          progress: 0,
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
      }

      const memories = [
        `My employment status: ${employmentLabel}.`,
        `I work in ${industryLabel}.`,
        `What I'm working toward: ${goalsLabel}.`,
        `My biggest challenge: ${challengeLabel}`,
        `My 30-day goal: ${thirtyDayGoal}`,
      ];

      const token = await user.getIdToken();
      for (const mem of memories) {
        await addDoc(collection(db, 'users', uid, 'memories'), {
          content: mem,
          source: 'onboarding',
          createdAt: serverTimestamp(),
        });
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
      <div className="flex gap-1 mb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-brand' : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted mb-8">{step + 1} of {TOTAL_STEPS}</p>

      {/* Step content */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-text mb-1">{current.title}</h1>
        {'subtitle' in current && current.subtitle && (
          <p className="text-sm text-muted mb-6">{current.subtitle}</p>
        )}
        {!('subtitle' in current) && <div className="mb-6" />}
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
          disabled={!stepValid[step] || saving}
          className="px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Setting up…' : isLast ? 'Launch my Modus →' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
