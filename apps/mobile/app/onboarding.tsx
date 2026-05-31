import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { API_BASE, getAuthHeader } from '@/lib/api';
import { AuthButtons } from '@/components/AuthButtons';
import { Icon, type IconName } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';

interface Option { icon: IconName; label: string; desc?: string }

const EMPLOYMENT: Option[] = [
  { icon: 'work', label: 'Employed full-time', desc: 'Working 9 to 5 and beyond' },
  { icon: 'bolt', label: 'Self-employed / freelancer', desc: 'Running your own show' },
  { icon: 'schedule', label: 'Employed part-time', desc: 'Splitting your time' },
  { icon: 'school', label: 'Student', desc: 'Still in the learning phase' },
  { icon: 'search', label: 'Between roles', desc: 'Looking for the next move' },
  { icon: 'more-horiz', label: 'Other' },
];
const INDUSTRY: Option[] = [
  { icon: 'code', label: 'Tech / software' },
  { icon: 'palette', label: 'Marketing / creative' },
  { icon: 'trending-up', label: 'Finance / business' },
  { icon: 'local-hospital', label: 'Healthcare' },
  { icon: 'school', label: 'Education' },
  { icon: 'handshake', label: 'Sales' },
  { icon: 'build', label: 'Trades / skilled labor' },
  { icon: 'more-horiz', label: 'Other' },
];
const GOALS: Option[] = [
  { icon: 'flag', label: 'Land a new job or role' },
  { icon: 'rocket-launch', label: 'Build a business or side project' },
  { icon: 'schedule', label: 'Get better at managing my time' },
  { icon: 'bolt', label: 'Ship more / be more productive at work' },
  { icon: 'psychology', label: 'Develop a new skill' },
  { icon: 'explore', label: 'Figure out what I actually want to do' },
  { icon: 'more-horiz', label: 'Other' },
];
const CHALLENGE: Option[] = [
  { icon: 'autorenew', label: "Know what to do but can't stay consistent" },
  { icon: 'waves', label: "Overwhelmed and don't know where to start" },
  { icon: 'smartphone', label: 'Get distracted too easily' },
  { icon: 'cloud', label: "Set goals but don't follow through" },
  { icon: 'map', label: "Don't have a clear plan" },
  { icon: 'more-horiz', label: 'Other' },
];
const TASKS: Option[] = [
  { icon: 'check-circle', label: 'I use a to-do app' },
  { icon: 'psychology', label: 'I keep it in my head' },
  { icon: 'edit-note', label: 'I use a notes app' },
  { icon: 'calendar-today', label: 'I use a calendar' },
  { icon: 'warning-amber', label: 'I have a system but it breaks down' },
  { icon: 'help-outline', label: "I don't really manage them" },
  { icon: 'more-horiz', label: 'Other' },
];

function OptionCard({ option, selected, onPress, multi }: {
  option: Option; selected: boolean; onPress: () => void; multi?: boolean;
}) {
  const c = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border ${
        selected ? 'border-brand bg-surface-2' : 'border-border bg-surface'
      }`}
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center ${selected ? 'bg-brand/20' : 'bg-surface-2'}`}>
        <Icon name={option.icon} size={20} color={selected ? c.brand : c.muted} />
      </View>
      <View className="flex-1">
        <Text className={`text-[15px] font-semibold ${selected ? 'text-brand-light' : 'text-text'}`}>
          {option.label}
        </Text>
        {option.desc && <Text className="text-muted text-xs mt-0.5">{option.desc}</Text>}
      </View>
      <View
        className={`items-center justify-center shrink-0 ${multi ? 'w-5 h-5 rounded-md' : 'w-5 h-5 rounded-full'} border-2 ${
          selected ? 'border-brand bg-brand' : 'border-muted/40'
        }`}
      >
        {selected && <Icon name="check" color="#fff" size={12} />}
      </View>
    </TouchableOpacity>
  );
}

function OtherInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Describe in your own words…"
      placeholderTextColor="#6b6b80"
      className="bg-bg border border-brand/40 rounded-xl px-4 py-3 text-text text-[15px] mt-2"
      autoFocus
    />
  );
}

type Screen = 'name' | number | 'done';
const TOTAL = 8;

export default function OnboardingScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('name');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
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

  function toggleGoal(g: string) {
    setGoals(prev => (prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]));
  }

  const stepValid: Record<number, boolean> = {
    1: employment !== '' && (employment !== 'Other' || employmentOther.trim() !== ''),
    2: industry !== '' && (industry !== 'Other' || industryOther.trim() !== ''),
    3: goals.length > 0 && (!goals.includes('Other') || goalsOther.trim() !== ''),
    4: challenge !== '' && (challenge !== 'Other' || challengeOther.trim() !== ''),
    5: thirtyDayGoal.trim() !== '',
    6: taskSystem !== '' && (taskSystem !== 'Other' || taskSystemOther.trim() !== ''),
    7: true,
  };

  // Seeds everything the user just answered, then enters the app. Called after
  // account creation on the final step (uid comes from the fresh sign-in).
  async function seedAndGo(uid: string) {
    setSaving(true);
    setScreen('done');
    try {
      // Don't clobber a returning user who happened to take the sign-up path.
      const existing = await getDoc(doc(db, 'users', uid));
      if (existing.data()?.onboardingComplete === true) {
        setTimeout(() => router.replace('/(app)/briefing'), 700);
        return;
      }

      const empLabel = employment === 'Other' ? employmentOther.trim() : employment;
      const indLabel = industry === 'Other' ? industryOther.trim() : industry;
      const goalsArr = goals.map(g => (g === 'Other' ? goalsOther.trim() : g));
      const chalLabel = challenge === 'Other' ? challengeOther.trim() : challenge;
      const taskLabel = taskSystem === 'Other' ? taskSystemOther.trim() : taskSystem;

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
        onboardingAnswers: {
          employment: empLabel, industry: indLabel, goals: goalsArr,
          challenge: chalLabel, thirtyDayGoal: thirtyDayGoal.trim(), taskSystem: taskLabel,
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
          title: thirtyDayGoal.trim(), description: '', status: 'active',
          progress: 0, source: 'onboarding', createdAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, 'users', uid, 'habits'), {
        name: 'Daily Review',
        description: 'Check in with MODUS each day. Review your goals, plan your day, and stay on track.',
        frequency: 'daily', target: 1, color: '#7c3aed', icon: '🔁',
        completedDates: [], source: 'onboarding', createdAt: serverTimestamp(),
      });

      const memories = [
        name.trim() && `My name is ${name.trim()}.`,
        empLabel && `Employment: ${empLabel}. Field: ${indLabel}.`,
        goalsArr.length && `What I'm working toward: ${goalsArr.join(', ')}.`,
        chalLabel && `My biggest challenge: ${chalLabel}.`,
        thirtyDayGoal.trim() && `My 30-day goal: ${thirtyDayGoal.trim()}.`,
      ].filter(Boolean) as string[];

      const headers = await getAuthHeader();
      for (const mem of memories) {
        await addDoc(collection(db, 'users', uid, 'memories'), {
          content: mem, source: 'onboarding', createdAt: serverTimestamp(),
        });
        fetch(`${API_BASE}/api/memory/upsert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ text: mem }),
        }).catch(() => {});
      }

      setTimeout(() => router.replace('/(app)/briefing'), 900);
    } catch {
      // Even if seeding partly fails, don't trap the user on onboarding.
      setTimeout(() => router.replace('/(app)/briefing'), 900);
    }
  }

  // ── name screen ──
  if (screen === 'name') {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 px-7 pt-10 justify-between pb-10">
          <View className="gap-6">
            <View>
              <Text className="text-brand-light text-xs font-bold uppercase tracking-widest mb-2">First things first</Text>
              <Text className="text-3xl font-black text-text leading-tight">What should{'\n'}MODUS call you?</Text>
              <Text className="text-muted text-sm mt-2">Your assistant needs a name for you.</Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor="#6b6b80"
              autoFocus
              className="bg-surface border border-border rounded-2xl px-5 py-4 text-text text-base"
            />
            <View className="bg-surface border border-border rounded-2xl px-5 py-4">
              <Text className="text-muted text-xs mb-1">Live preview</Text>
              <Text className="text-text text-sm leading-relaxed">
                "{name.trim()
                  ? `${greeting}, ${name.trim()}. I'm MODUS. Let's get to work.`
                  : `${greeting}. I'm MODUS. What are we working on today?`}"
              </Text>
            </View>
          </View>
          <View className="gap-4">
            <TouchableOpacity
              disabled={!name.trim()}
              activeOpacity={0.85}
              onPress={() => setScreen(1)}
              className="bg-brand rounded-2xl py-4 items-center"
              style={{ opacity: name.trim() ? 1 : 0.4 }}
            >
              <Text className="text-white font-bold text-base">Continue →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="py-1">
              <Text className="text-muted text-sm text-center">
                Already have an account? <Text className="text-brand-light font-semibold">Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── done screen ──
  if (screen === 'done') {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center gap-4">
        <Text className="text-4xl font-black text-brand tracking-widest">MODUS</Text>
        <Text className="text-text font-bold text-lg">
          MODUS is ready{name.trim() ? `, ${name.trim()}` : ''}.
        </Text>
        <Text className="text-muted text-sm">Setting up your workspace…</Text>
        <ActivityIndicator color="#7C3AED" className="mt-2" />
      </SafeAreaView>
    );
  }

  // ── step screens ──
  const step = screen as number;
  const isLast = step === TOTAL;
  const progress = (step / TOTAL) * 100;
  const alreadyAuthed = !!auth.currentUser;

  const config: Record<number, { label: string; title: string; subtitle?: string; body: React.ReactNode }> = {
    1: {
      label: `Step 1 of ${TOTAL} · Who you are`,
      title: 'What best describes your situation?',
      body: (
        <View className="gap-2">
          {EMPLOYMENT.map(o => (
            <View key={o.label}>
              <OptionCard option={o} selected={employment === o.label} onPress={() => setEmployment(o.label)} />
              {o.label === 'Other' && employment === 'Other' && <OtherInput value={employmentOther} onChange={setEmploymentOther} />}
            </View>
          ))}
        </View>
      ),
    },
    2: {
      label: `Step 2 of ${TOTAL} · Work context`,
      title: 'What field are you in?',
      subtitle: 'Or were in, if between roles.',
      body: (
        <View className="gap-2">
          {INDUSTRY.map(o => (
            <View key={o.label}>
              <OptionCard option={o} selected={industry === o.label} onPress={() => setIndustry(o.label)} />
              {o.label === 'Other' && industry === 'Other' && <OtherInput value={industryOther} onChange={setIndustryOther} />}
            </View>
          ))}
        </View>
      ),
    },
    3: {
      label: `Step 3 of ${TOTAL} · Goals`,
      title: 'What are we working on?',
      subtitle: 'Pick all that apply.',
      body: (
        <View className="gap-2">
          {GOALS.map(o => (
            <View key={o.label}>
              <OptionCard option={o} multi selected={goals.includes(o.label)} onPress={() => toggleGoal(o.label)} />
              {o.label === 'Other' && goals.includes('Other') && <OtherInput value={goalsOther} onChange={setGoalsOther} />}
            </View>
          ))}
        </View>
      ),
    },
    4: {
      label: `Step 4 of ${TOTAL} · Biggest blocker`,
      title: "What's your biggest challenge right now?",
      body: (
        <View className="gap-2">
          {CHALLENGE.map(o => (
            <View key={o.label}>
              <OptionCard option={o} selected={challenge === o.label} onPress={() => setChallenge(o.label)} />
              {o.label === 'Other' && challenge === 'Other' && <OtherInput value={challengeOther} onChange={setChallengeOther} />}
            </View>
          ))}
        </View>
      ),
    },
    5: {
      label: `Step 5 of ${TOTAL} · Right now`,
      title: 'What do you want to accomplish in the next 30 days?',
      body: (
        <View className="gap-2">
          <TextInput
            value={thirtyDayGoal}
            onChangeText={setThirtyDayGoal}
            placeholder="Be specific — MODUS will hold you to it."
            placeholderTextColor="#6b6b80"
            multiline
            autoFocus
            className="bg-surface border border-border rounded-2xl px-5 py-4 text-text text-[15px]"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Text className="text-muted text-xs px-1">This becomes your first tracked goal in MODUS.</Text>
        </View>
      ),
    },
    6: {
      label: `Step 6 of ${TOTAL} · How you operate`,
      title: 'How do you manage tasks today?',
      body: (
        <View className="gap-2">
          {TASKS.map(o => (
            <View key={o.label}>
              <OptionCard option={o} selected={taskSystem === o.label} onPress={() => setTaskSystem(o.label)} />
              {o.label === 'Other' && taskSystem === 'Other' && <OtherInput value={taskSystemOther} onChange={setTaskSystemOther} />}
            </View>
          ))}
        </View>
      ),
    },
    7: {
      label: `Step 7 of ${TOTAL} · Your first habit`,
      title: 'Start with one habit',
      subtitle: "We've picked the one that makes everything else work.",
      body: (
        <View className="gap-4">
          <View className="bg-surface-2 border border-brand/30 rounded-2xl p-5 gap-3">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-2xl bg-brand/20 items-center justify-center">
                <Icon name="autorenew" tone="brand" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base">Daily Review</Text>
                <Text className="text-muted text-xs">Every day · ~2 minutes</Text>
              </View>
              <View className="bg-brand/15 px-2.5 py-1 rounded-full">
                <Text className="text-brand-light text-xs font-semibold">Added</Text>
              </View>
            </View>
            <Text className="text-muted text-sm leading-relaxed">
              Check in with MODUS each day. Review your goals, plan your day, and stay on track. The single habit that makes everything else work.
            </Text>
          </View>
          <Text className="text-muted text-xs text-center">
            This habit will appear in your Habits tab and be tracked every day.
            {name.trim() ? ` You've got this, ${name.trim()}.` : ''}
          </Text>
        </View>
      ),
    },
    8: {
      label: `Step 8 of ${TOTAL} · Save your setup`,
      title: name.trim() ? `You're all set, ${name.trim()}.` : "You're all set.",
      subtitle: 'Create your account to save everything and meet MODUS.',
      body: (
        <View className="gap-5">
          <View className="bg-surface border border-border rounded-2xl p-5 gap-3">
            <Text className="text-muted text-xs uppercase tracking-wider font-semibold">What MODUS will set up</Text>
            {[
              thirtyDayGoal.trim() ? `Your 30-day goal: "${thirtyDayGoal.trim()}"` : 'Your first goal',
              'A Daily Review habit to keep you on track',
              'A memory of who you are and what you want',
            ].map((line, i) => (
              <View key={i} className="flex-row items-start gap-2.5">
                <View className="mt-0.5"><Icon name="check" tone="brand" size={16} /></View>
                <Text className="text-text text-sm flex-1 leading-snug">{line}</Text>
              </View>
            ))}
          </View>

          {alreadyAuthed ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={saving}
              onPress={() => seedAndGo(auth.currentUser!.uid)}
              className="bg-brand rounded-2xl py-4 items-center"
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              <Text className="text-white font-bold text-base">Finish & launch MODUS →</Text>
            </TouchableOpacity>
          ) : (
            <AuthButtons afterSignIn={seedAndGo} />
          )}

          <Text className="text-muted/70 text-[11px] text-center px-4 leading-4">
            30-day free trial · No credit card required
          </Text>
        </View>
      ),
    },
  };

  const current = config[step];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Progress */}
      <View className="px-7 pt-4">
        <View className="h-1 bg-border rounded-full overflow-hidden">
          <View className="h-full bg-brand rounded-full" style={{ width: `${progress}%` }} />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-muted text-xs">{current.label}</Text>
          <Text className="text-muted text-xs">{Math.round(progress)}%</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 28, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-black text-text leading-tight">{current.title}</Text>
        {current.subtitle && <Text className="text-muted text-sm mt-1.5 mb-1">{current.subtitle}</Text>}
        <View className="mt-5">{current.body}</View>
      </ScrollView>

      {/* Bottom nav */}
      <View className="flex-row items-center justify-between px-7 pt-3 pb-8 border-t border-border">
        <TouchableOpacity
          onPress={() => setScreen(step === 1 ? 'name' : step - 1)}
          className="py-2 pr-4"
        >
          <Text className="text-muted text-sm">← Back</Text>
        </TouchableOpacity>
        {!isLast && (
          <TouchableOpacity
            disabled={!stepValid[step]}
            activeOpacity={0.85}
            onPress={() => setScreen(step + 1)}
            className="bg-brand rounded-2xl px-7 py-3"
            style={{ opacity: stepValid[step] ? 1 : 0.4 }}
          >
            <Text className="text-white font-bold text-sm">Continue →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
