'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';

// ── animation helpers ───────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

// ── thinking dots ───────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          className="w-1.5 h-1.5 rounded-full bg-purple-400"
        />
      ))}
    </div>
  );
}

// ── chat message bubble ─────────────────────────────────────────────────────
function ChatMsg({ role, text }: { role: 'modus' | 'user'; text: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.35 }}
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        role === 'user'
          ? 'bg-purple-600 text-white rounded-br-sm'
          : 'bg-[#1a1a2e] border border-white/10 text-gray-200 rounded-tl-sm'
      }`}>
        {text}
      </div>
    </motion.div>
  );
}

// ── action card ─────────────────────────────────────────────────────────────
function ActionCard({ actions, buttons }: { actions: { label: string; detail: string; badge?: string }[]; buttons?: string[] }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
      className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Action set ready</span>
      </div>
      <div className="divide-y divide-white/5">
        {actions.map((a, i) => (
          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white font-medium">{a.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.detail}</p>
            </div>
            {a.badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${a.badge === 'Urgent' ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-300'}`}>{a.badge}</span>}
          </div>
        ))}
      </div>
      {buttons && (
        <div className="px-4 py-3 border-t border-white/10 flex gap-2">
          <button className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">{buttons[0]}</button>
          {buttons[1] && <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-lg transition-colors">{buttons[1]}</button>}
        </div>
      )}
    </motion.div>
  );
}

// ── tab scenarios ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'morning',  label: 'Morning briefing' },
  { id: 'followup', label: 'Missed follow-up' },
  { id: 'sales',    label: 'Sales goal' },
  { id: 'recover',  label: 'Recover' },
  { id: 'goal',     label: 'Set a goal' },
  { id: 'inbox',    label: 'Inbox triage' },
  { id: 'memory',   label: 'Memory' },
];

type SceneItem =
  | { type: 'msg'; role: 'modus' | 'user'; text: string; delay: number }
  | { type: 'thinking'; delay: number }
  | { type: 'card'; delay: number; component: React.ReactNode };

const SCENES: Record<string, SceneItem[]> = {
  morning: [
    { type: 'msg', role: 'modus', text: 'Good morning. Your HRV is up — good energy day. You have 3 emails that need replies, one meeting at 2 PM, and two tasks from yesterday still open. I\'ve queued up an action set.', delay: 400 },
    { type: 'msg', role: 'user', text: 'Handle the emails and protect my morning.', delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Reply to David re: investor update', detail: 'Draft ready for review' },
      { label: 'Follow up with Sarah on the contract', detail: 'Draft ready for review' },
      { label: 'Acknowledge receipt to the accountant', detail: 'Short reply drafted' },
      { label: 'Block 8–11 AM as deep work', detail: 'Removed from booking availability' },
    ]} buttons={['Approve all', 'Review drafts']} /> },
  ],
  followup: [
    { type: 'msg', role: 'modus', text: "Heads up — you emailed Jordan about a partnership 9 days ago and never got a reply. You also marked him as a priority contact last week.", delay: 400 },
    { type: 'msg', role: 'user', text: "Send a follow-up. Keep it short.", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Follow-up email to Jordan', detail: '"Hey Jordan, just circling back — still think there\'s something worth exploring."' },
    ]} buttons={['Approve & send', 'Edit first']} /> },
  ],
  sales: [
    { type: 'msg', role: 'modus', text: "It's been 6 days since you set your goal to close 3 new clients this month. You've had 2 sales calls — no closes yet. You're behind pace.", delay: 400 },
    { type: 'msg', role: 'user', text: "What do I need to do today to get back on track?", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Block 3–5 PM for outreach calls', detail: 'Added to calendar as focus time' },
      { label: 'Reminder at 2:45 PM to prep your call list', detail: 'Push notification set' },
      { label: 'Add "Send 5 follow-up DMs" to today\'s task list', detail: 'Task created with end-of-day deadline' },
    ]} buttons={['Approve all', 'Adjust']} /> },
  ],
  recover: [
    { type: 'msg', role: 'modus', text: "Your watch data shows 4.5 hrs of sleep and elevated resting heart rate. Recovery score is low. You have a packed schedule today.", delay: 400 },
    { type: 'msg', role: 'user', text: "Can you lighten today up?", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Move 10 AM sync with team to tomorrow', detail: 'Reschedule request drafted' },
      { label: 'Block 1–2 PM as no-meeting recovery', detail: 'Marked as unavailable' },
      { label: 'Reminder at 9 PM to wind down', detail: '"You had a rough night — lights out by 10."' },
    ]} buttons={['Approve all', 'Review']} /> },
  ],
  goal: [
    { type: 'msg', role: 'user', text: "I want to make $10k this month. Help me build a plan.", delay: 300 },
    { type: 'thinking', delay: 900 },
    { type: 'msg', role: 'modus', text: "Got it. Based on your current workload and schedule, here's how I'd break that down — and I'll track it week by week so nothing falls behind.", delay: 1700 },
    { type: 'card', delay: 2600, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Goal plan · $10k this month</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { week: 'Week 1', title: 'Identify and reach out to 20 prospects', note: 'Daily outreach reminder at 9 AM' },
            { week: 'Week 2', title: 'Book 5 discovery calls', note: 'Calendar blocks + prep briefs auto-generated' },
            { week: 'Week 3', title: 'Close 2 deals, follow up on the rest', note: 'MODUS tracks replies, flags cold leads' },
            { week: 'Week 4', title: 'Invoice, collect, and review', note: 'MODUS drafts invoices + sends progress summary' },
          ].map((w, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full h-fit mt-0.5 shrink-0">{w.week}</span>
              <div>
                <p className="text-sm text-white">{w.title}</p>
                <p className="text-xs text-gray-400">{w.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-white/10 flex gap-2">
          <button className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">Approve plan</button>
          <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-lg transition-colors">Adjust</button>
        </div>
      </motion.div>
    )},
  ],
  inbox: [
    { type: 'msg', role: 'modus', text: "You woke up to 47 emails. I've already gone through them. Only 3 actually need you — I've drafted replies for all of them.", delay: 400 },
    { type: 'msg', role: 'user', text: "Show me what needs my attention.", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Needs your reply today (3)</p>
        </div>
        {[
          { from: 'Alex', subject: '"Contract ready to sign"', badge: 'Reply drafted', urgent: false },
          { from: 'Marcus', subject: '"Quick question on the deck"', badge: 'Reply drafted', urgent: false },
          { from: 'Your accountant', subject: '"Invoice overdue"', badge: 'Urgent', urgent: true },
        ].map((e, i) => (
          <div key={i} className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white font-medium">{e.from}</p>
              <p className="text-xs text-gray-400">{e.subject}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${e.urgent ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-300'}`}>{e.badge}</span>
          </div>
        ))}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Noise — already buried (44)</p>
          <p className="text-xs text-gray-500">Newsletters, promos, notifications · Archived. You won't see them unless you ask.</p>
        </div>
        <div className="px-4 py-3 flex gap-2">
          <button className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">Approve all 3 replies</button>
          <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-lg transition-colors">Review drafts</button>
        </div>
      </motion.div>
    )},
  ],
  memory: [
    { type: 'msg', role: 'modus', text: "Something came up in your memory from 3 weeks ago that I think is worth revisiting.", delay: 400 },
    { type: 'card', delay: 1200, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-purple-900/30 border border-purple-500/40 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-500/20">
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Memory · 3 weeks ago</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-white italic">"I think I want to pivot my offer and go more premium by Q3."</p>
          <p className="text-xs text-gray-400">You said this 3 weeks ago — it hasn't come up since.</p>
          <p className="text-sm text-purple-200 font-medium">It's week 6 of Q2. Do you want to start building that out now so you're ready?</p>
        </div>
        <div className="px-4 py-3 border-t border-purple-500/20 flex gap-2">
          <button className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">Yes, let's plan it</button>
          <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-lg transition-colors">Not yet</button>
        </div>
      </motion.div>
    )},
  ],
};

// ── scenario player ─────────────────────────────────────────────────────────
function ScenarioPlayer({ tabId }: { tabId: string }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleCount(0);
    setShowThinking(false);

    const scene = SCENES[tabId] ?? [];
    let msgIdx = 0;

    scene.forEach(item => {
      if (item.type === 'thinking') {
        const t1 = setTimeout(() => setShowThinking(true), item.delay);
        timeoutsRef.current.push(t1);
      } else {
        const capturedIdx = msgIdx++;
        const t2 = setTimeout(() => {
          setShowThinking(false);
          setVisibleCount(capturedIdx + 1);
        }, item.delay);
        timeoutsRef.current.push(t2);
      }
    });

    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [tabId]);

  const scene = SCENES[tabId] ?? [];
  const renderItems = scene.filter(s => s.type !== 'thinking');

  return (
    <div className="space-y-3 p-5 h-[480px] overflow-y-auto flex flex-col justify-end">
      <AnimatePresence>
        {renderItems.slice(0, visibleCount).map((item, i) => (
          <div key={i}>
            {item.type === 'msg' && <ChatMsg role={item.role} text={item.text} />}
            {item.type === 'card' && item.component}
          </div>
        ))}
        {showThinking && (
          <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ThinkingDots />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── section wrapper ─────────────────────────────────────────────────────────
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`px-6 py-20 max-w-5xl mx-auto ${className}`}>{children}</section>;
}

function Eyebrow({ text }: { text: string }) {
  return <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">{text}</p>;
}

// ── main page ───────────────────────────────────────────────────────────────
export default function HowItWorksPage() {
  const [activeTab, setActiveTab] = useState('morning');

  return (
    <div className="bg-bg text-text min-h-screen">
      <Navbar solid />
      <div className="pt-16">

      {/* Section 1 — Hero */}
      <Section>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Eyebrow text="How it works" />
          <h1 className="text-4xl md:text-5xl font-black text-text leading-tight mb-6">
            An AI that runs your day.<br />Not one you have to run.
          </h1>
          <div className="max-w-2xl space-y-4">
            <p className="text-muted text-lg leading-relaxed">
              ChatGPT and Claude are tools. Powerful ones — but tools. You go to them, ask a question, get an answer, and then you go do the work yourself. MODUS is built on a different premise: your AI should be the one taking action, not just giving advice.
            </p>
            <p className="text-muted text-lg leading-relaxed">
              MODUS is your executive assistant. It manages your schedule, sends your emails, sets your reminders, texts you when something needs your attention, and surfaces decisions for your approval — all from a single conversation.
            </p>
          </div>
        </motion.div>
      </Section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Section 2 — 4 steps */}
      <Section>
        <Eyebrow text="The flow" />
        <h2 className="text-3xl font-black text-text mb-3">One message. Everything handled.</h2>
        <p className="text-muted mb-12 max-w-xl">You don't navigate menus or open different apps. You tell MODUS what you need and it moves.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { n: '01', title: 'You connect your life', desc: 'Calendar, email, health data, apps — MODUS reads across all of it. The more context it has, the less you have to explain.' },
            { n: '02', title: 'MODUS learns your operating style', desc: 'Through onboarding and ongoing usage, MODUS understands your goals, your schedule, your priorities, and how you like to work.' },
            { n: '03', title: 'It acts — or tells you it\'s about to', desc: 'Reminders get set. Emails get drafted. Blocks go on your calendar. For anything that touches the outside world, MODUS surfaces an approval card first.' },
            { n: '04', title: 'You approve in one tap', desc: "You're not managing software. You're the executive. MODUS brings decisions to you — you say yes, edit, or redirect." },
          ].map(step => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-panel border border-border rounded-2xl p-6"
            >
              <p className="text-4xl font-black text-purple-500/30 mb-3">{step.n}</p>
              <h3 className="text-base font-bold text-text mb-2">{step.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Section 3 — Animated scenarios */}
      <Section>
        <Eyebrow text="One message. Everything handled." />
        <h2 className="text-3xl font-black text-text mb-2">See it in action.</h2>
        <p className="text-muted mb-10">Real scenarios. One conversation each.</p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat window */}
        <div className="bg-[#0f0f1e] border border-white/10 rounded-2xl overflow-hidden">
          {/* Window bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="text-xs text-gray-500 ml-2">MODUS Chat</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ScenarioPlayer tabId={activeTab} />
            </motion.div>
          </AnimatePresence>
        </div>
      </Section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Section 4 — Differentiation table */}
      <Section>
        <Eyebrow text="The difference" />
        <h2 className="text-3xl font-black text-text mb-10">Other AI answers. MODUS acts.</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-6 text-muted font-medium w-1/4" />
                <th className="text-left py-3 px-4 text-muted font-semibold">ChatGPT / Claude</th>
                <th className="text-left py-3 px-4 text-purple-300 font-semibold bg-purple-500/10 rounded-t-xl">MODUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                {
                  dim: 'What it is',
                  them: 'A chat interface. You ask, it replies. The work is still yours.',
                  us: 'A command. MODUS takes the action on your behalf.',
                },
                {
                  dim: 'Who initiates',
                  them: 'You open the app, type a prompt, get a response.',
                  us: 'MODUS reaches out to you. Texts, reminders, alerts — without being asked.',
                },
                {
                  dim: 'Connected to',
                  them: 'Lives in a tab. No access to your real calendar, email, or phone.',
                  us: 'Email, calendar, SMS, watch, health data, and more.',
                },
                {
                  dim: 'After the chat',
                  them: 'Closes the tab, the conversation ends. No follow-through.',
                  us: 'MODUS keeps going. Tracks, follows up, and checks in until it\'s done.',
                },
              ].map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <td className="py-4 pr-6 text-muted font-medium align-top">{row.dim}</td>
                  <td className="py-4 px-4 text-muted align-top leading-relaxed">{row.them}</td>
                  <td className="py-4 px-4 text-text align-top leading-relaxed bg-purple-500/10">{row.us}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Section 5 — Integrations */}
      <Section>
        <Eyebrow text="Integrations" />
        <h2 className="text-3xl font-black text-text mb-2">Connected to your whole life.</h2>
        <p className="text-muted mb-10">MODUS doesn't live in one app. It lives across all of them.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: '✉', name: 'Email', desc: 'Draft, send, follow up' },
            { icon: '📅', name: 'Calendar', desc: 'Schedule, block, reschedule' },
            { icon: '💬', name: 'SMS', desc: 'Texts & check-ins' },
            { icon: '⌚', name: 'Watch & health', desc: 'Activity & recovery data' },
            { icon: '🔔', name: 'Reminders', desc: 'Push, alarm, or call' },
            { icon: '⚡', name: 'Whop', desc: 'Commerce & subscriptions' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="bg-panel border border-border rounded-2xl p-5"
            >
              <span className="text-2xl mb-3 block">{item.icon}</span>
              <p className="text-sm font-semibold text-text">{item.name}</p>
              <p className="text-xs text-muted mt-1">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Section 6 — Closing */}
      <Section className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          <Eyebrow text="The bigger idea" />
          <h2 className="text-3xl md:text-4xl font-black text-text">
            You're the executive.<br />MODUS handles the rest.
          </h2>
          <p className="text-muted text-lg leading-relaxed">
            The goal isn't to make you better at using software. It's to get you out of the software entirely. Tell MODUS what matters. It figures out how to make it happen — and brings you in only when a human decision is needed.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
          >
            Start your free trial →
          </Link>
          <p className="text-xs text-muted">4 days free. No credit card needed.</p>
        </motion.div>
      </Section>
      </div>
    </div>
  );
}
