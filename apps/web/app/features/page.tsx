'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/marketing/Navbar';
import { MarketingBackground, ScrollProgress } from '@/components/marketing/MarketingBackground';
import { MODEL_LOGOS } from '@/components/marketing/ModelLogos';
import ModelCompareDemo from '@/components/marketing/ModelCompareDemo';
import StackSection from '@/components/marketing/StackSection';
import CreationsSection from '@/components/marketing/CreationsSection';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function RevealOnScroll({ children, delay = 0, direction = 'up' }: { children: React.ReactNode; delay?: number; direction?: 'up' | 'left' | 'right' | 'none' }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });
  const offsets = { up: { y: 32, x: 0 }, left: { y: 0, x: 32 }, right: { y: 0, x: -32 }, none: { y: 0, x: 0 } };
  const { x, y } = offsets[direction];
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x, y, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ModusAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
      <Image src="/logo.png" alt="MODUS" width={14} height={14} className="opacity-75" />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-end gap-2.5">
      <ModusAvatar />
      <div className="flex items-center gap-1 px-4 py-3 bg-panel rounded-2xl rounded-tl-sm w-fit">
        {[0, 1, 2].map(i => (
          <motion.div key={i} animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-brand" />
        ))}
      </div>
    </div>
  );
}

function ChatMsg({ role, text }: { role: 'modus' | 'user'; text: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-end gap-2.5 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {role === 'modus' && <ModusAvatar />}
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        role === 'user'
          ? 'bg-brand text-white rounded-br-sm'
          : 'bg-panel text-text rounded-tl-sm'
      }`}>
        {text}
      </div>
    </motion.div>
  );
}

function ActionCard({ actions, buttons }: { actions: { label: string; detail: string; badge?: string }[]; buttons?: string[] }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
      className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/25 ring-1 ring-brand/20">
      <div className="px-4 py-3 flex items-center gap-2 bg-brand/[0.07]">
        <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="text-xs font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Action set ready</span>
      </div>
      <div className="divide-y divide-text/[0.06]">
        {actions.map((a, i) => (
          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-text font-medium">{a.label}</p>
              <p className="text-xs text-muted mt-0.5">{a.detail}</p>
            </div>
            {a.badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${a.badge === 'Urgent' ? 'bg-red-500/20 text-red-400' : 'bg-brand/10 text-brand'}`}>{a.badge}</span>}
          </div>
        ))}
      </div>
      {buttons && (
        <div className="px-4 py-3 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-2 text-white text-xs font-semibold rounded-lg">{buttons[0]}</button>
          {buttons[1] && <button className="flex-1 py-2 bg-bg/80 hover:bg-border text-muted text-xs font-semibold rounded-lg transition-colors">{buttons[1]}</button>}
        </div>
      )}
    </motion.div>
  );
}

const TABS = [
  { id: 'morning',  label: 'Morning' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'sales',    label: 'Sales goal' },
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
    { type: 'msg', role: 'modus', text: 'Good morning. Your HRV is up, so this is a good energy day. You have 3 emails that need replies, one meeting at 2 PM, and two tasks from yesterday still open. I\'ve queued up an action set.', delay: 400 },
    { type: 'msg', role: 'user', text: 'Handle the emails and protect my morning.', delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Reply to David re: investor update', detail: 'Draft ready for review' },
      { label: 'Follow up with Sarah on the contract', detail: 'Draft ready for review' },
      { label: 'Block 8–11 AM as deep work', detail: 'Removed from booking availability' },
    ]} buttons={['Approve all', 'Review drafts']} /> },
  ],
  followup: [
    { type: 'msg', role: 'modus', text: "Heads up. You emailed Jordan about a partnership 9 days ago and never got a reply. You also marked him as a priority contact last week.", delay: 400 },
    { type: 'msg', role: 'user', text: "Send a follow-up. Keep it short.", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Follow-up to Jordan', detail: '"Hey Jordan, just circling back. Still think there\'s something worth exploring."' },
    ]} buttons={['Approve & send', 'Edit first']} /> },
  ],
  sales: [
    { type: 'msg', role: 'modus', text: "It's been 6 days since you set your goal to close 3 new clients this month. You've had 2 calls and no closes yet. You're behind pace.", delay: 400 },
    { type: 'msg', role: 'user', text: "What do I need to do today to get back on track?", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: <ActionCard actions={[
      { label: 'Block 3–5 PM for outreach calls', detail: 'Added to calendar as focus time' },
      { label: 'Reminder at 2:45 PM to prep call list', detail: 'Push notification set' },
      { label: 'Add "Send 5 follow-up DMs" to today', detail: 'Task with end-of-day deadline' },
    ]} buttons={['Approve all', 'Adjust']} /> },
  ],
  goal: [
    { type: 'msg', role: 'user', text: "I want to make $10k this month. Help me build a plan.", delay: 300 },
    { type: 'thinking', delay: 900 },
    { type: 'msg', role: 'modus', text: "Got it. Based on your current workload and schedule, here's how I'd break that down, and I'll track it week by week.", delay: 1700 },
    { type: 'card', delay: 2600, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/25 ring-1 ring-brand/20">
        <div className="px-4 py-3 bg-brand/[0.07]">
          <span className="text-xs font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Goal plan · $10k this month</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { week: 'Week 1', title: 'Identify and reach out to 20 prospects', note: 'Daily outreach reminder at 9 AM' },
            { week: 'Week 2', title: 'Book 5 discovery calls', note: 'Calendar blocks + prep briefs auto-generated' },
            { week: 'Week 3', title: 'Close 2 deals, follow up on the rest', note: 'MODUS tracks replies, flags cold leads' },
            { week: 'Week 4', title: 'Invoice, collect, and review', note: 'Invoices drafted + progress summary sent' },
          ].map((w, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full h-fit mt-0.5 shrink-0">{w.week}</span>
              <div><p className="text-sm text-text">{w.title}</p><p className="text-xs text-muted">{w.note}</p></div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-2 text-white text-xs font-semibold rounded-lg">Approve plan</button>
          <button className="flex-1 py-2 bg-bg/80 hover:bg-border text-muted text-xs font-semibold rounded-lg transition-colors">Adjust</button>
        </div>
      </motion.div>
    )},
  ],
  inbox: [
    { type: 'msg', role: 'modus', text: "You woke up to 47 emails. I've gone through them. Only 3 actually need you. I've drafted replies for all of them.", delay: 400 },
    { type: 'msg', role: 'user', text: "Show me what needs my attention.", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/25 ring-1 ring-brand/20">
        <div className="px-4 py-3 bg-brand/[0.07]">
          <p className="text-xs font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Needs your reply today (3)</p>
        </div>
        {[
          { from: 'Alex', subject: '"Contract ready to sign"', badge: 'Reply drafted', urgent: false },
          { from: 'Marcus', subject: '"Quick question on the deck"', badge: 'Reply drafted', urgent: false },
          { from: 'Your accountant', subject: '"Invoice overdue"', badge: 'Urgent', urgent: true },
        ].map((e, i) => (
          <div key={i} className="px-4 py-3 border-b border-text/[0.06] flex items-center justify-between gap-3">
            <div><p className="text-sm text-text font-medium">{e.from}</p><p className="text-xs text-muted">{e.subject}</p></div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${e.urgent ? 'bg-red-500/20 text-red-400' : 'bg-brand/10 text-brand'}`}>{e.badge}</span>
          </div>
        ))}
        <div className="px-4 py-3 border-b border-text/[0.06]">
          <p className="text-xs text-muted/60 uppercase tracking-wider font-semibold mb-1">44 buried</p>
          <p className="text-xs text-muted/60">Newsletters, promos, notifications, all archived.</p>
        </div>
        <div className="px-4 py-3 flex gap-2">
          <button className="btn-primary flex-1 py-2 text-white text-xs font-semibold rounded-lg">Approve all 3</button>
          <button className="flex-1 py-2 bg-bg/80 text-muted text-xs font-semibold rounded-lg">Review drafts</button>
        </div>
      </motion.div>
    )},
  ],
  memory: [
    { type: 'msg', role: 'modus', text: "Something came up in your memory from 3 weeks ago that I think is worth revisiting.", delay: 400 },
    { type: 'card', delay: 1200, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/25 ring-1 ring-brand/25">
        <div className="px-4 py-3 bg-brand/[0.07]">
          <span className="text-xs font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Memory · 3 weeks ago</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-text italic">"I think I want to pivot my offer and go more premium by Q3."</p>
          <p className="text-xs text-muted">You said this 3 weeks ago and it hasn't come up since.</p>
          <p className="text-sm text-brand font-medium">It's week 6 of Q2. Want to start building that out now?</p>
        </div>
        <div className="px-4 py-3 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-2 text-white text-xs font-semibold rounded-lg">Yes, let's plan it</button>
          <button className="flex-1 py-2 bg-bg/80 text-muted text-xs font-semibold rounded-lg">Not yet</button>
        </div>
      </motion.div>
    )},
  ],
};

function ScenarioPlayer({ tabId }: { tabId: string }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleCount(0); setShowThinking(false); setDone(false);
    const scene = SCENES[tabId] ?? [];
    let msgIdx = 0, maxDelay = 0;
    scene.forEach(item => {
      if (item.delay > maxDelay) maxDelay = item.delay;
      if (item.type === 'thinking') {
        timeoutsRef.current.push(setTimeout(() => setShowThinking(true), item.delay));
      } else {
        const idx = msgIdx++;
        timeoutsRef.current.push(setTimeout(() => { setShowThinking(false); setVisibleCount(idx + 1); }, item.delay));
      }
    });
    timeoutsRef.current.push(setTimeout(() => setDone(true), maxDelay + 1000));
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [tabId, replayKey]);

  const scene = SCENES[tabId] ?? [];
  const renderItems = scene.filter(s => s.type !== 'thinking');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it plays. Needed because the scroll container is
  // the outer div now (see below), so new messages land below the fold.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleCount, showThinking]);

  return (
    <div className="relative">
      {/* The scroller must be a plain block: a flex column with justify-end makes
          overflow past the TOP unreachable (and visually clipped), which cut the
          first message off once a scene grew past the fixed height. The inner
          min-h-full child keeps short scenes pinned to the bottom instead. */}
      <div ref={scrollRef} className="h-[460px] overflow-y-auto">
        <div className="min-h-full flex flex-col justify-end space-y-3 p-5 pb-14">
          <AnimatePresence>
            {renderItems.slice(0, visibleCount).map((item, i) => (
              <div key={`${tabId}-${replayKey}-${i}`}>
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
      </div>
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-4 right-4">
            <button onClick={() => { setReplayKey(k => k + 1); setDone(false); }}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-text bg-panel hover:bg-text/[0.09] px-3 py-1.5 rounded-full transition-colors shadow-lg shadow-black/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Replay
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState('morning');

  return (
    <div className="bg-bg text-text min-h-screen relative overflow-x-hidden">
      <ScrollProgress />
      <MarketingBackground />
      <Navbar solid />

      <div className="relative pt-24" style={{ zIndex: 2 }}>

        {/* Hero */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16,1,0.3,1] }}>
            <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-4">Features</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-text leading-[1.08] mb-8 tracking-tight">
              Every AI you pay for.<br />
              <span className="text-brand dark:text-brand-light">One that knows you.</span>
            </h1>
            <div className="max-w-2xl space-y-4">
              <p className="text-muted text-lg leading-relaxed">
                ChatGPT, Claude and Gemini are tools you go to. You pick the tab, you paste the context, you explain yourself again. MODUS has all of them, sends each task to whichever is best, and already knows your week. Then it does the thing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-8">
              {['Every frontier model', 'Reads your email & calendar', 'Makes images, charts, docs', 'Acts with your approval', 'One $24 bill'].map(tag => (
                <span key={tag} className="text-xs font-medium text-brand dark:text-brand-light bg-brand/10 px-3 py-1.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Every model — promoted to the top: it's the reason to pick MODUS over
            a single-model chatbot, and it used to sit 3 sections down. */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <RevealOnScroll>
            <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-3">Every model</p>
            <h2 className="text-4xl md:text-5xl font-semibold text-text mb-4 tracking-tight">One prompt. Every model. One bill.</h2>
            <p className="text-muted text-lg leading-relaxed max-w-2xl mb-8">
              MODUS isn&apos;t tied to one AI. Write with Gemini, research with Claude, ask ChatGPT. Pick the model per message, leave it on <span className="text-text font-semibold">Auto</span> and MODUS routes each task to whichever model is best, or ask all three at once and see who wins.
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <div className="flex flex-wrap gap-2 mb-10">
              {MODEL_LOGOS.map(m => {
                const Logo = m.logo;
                return (
                  <span key={m.name} className="inline-flex items-center gap-1.5 bg-panel rounded-full pl-2 pr-3 py-1.5">
                    <Logo className="w-4 h-4" />
                    <span className="text-xs font-semibold text-text">{m.name}</span>
                  </span>
                );
              })}
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <ModelCompareDemo />
            <p className="text-sm text-muted mt-4">
              <span className="text-text font-medium">Compare mode</span> — one prompt, three models, side by side, with a verdict. Live in chat on PILOT.
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <div className="grid sm:grid-cols-3 gap-4 mt-10">
              {[
                { t: 'Auto-routing', d: 'MODUS reads the task and sends it to the model that does it best. You never pick a tab again.' },
                { t: 'Manual pick', d: 'Want Claude for this one? Switch model right in the composer, mid-conversation.' },
                { t: 'One subscription', d: '$140/mo of separate AI tools, replaced by one $24 bill with memory of you.' },
              ].map(c => (
                <div key={c.t} className="bg-panel rounded-2xl p-5 ring-1 ring-brand/20">
                  <h3 className="text-sm font-bold text-text mb-1.5">{c.t}</h3>
                  <p className="text-xs text-muted leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </section>

        {/* The math — the reason to switch, stated in numbers a reader can check. */}
        <StackSection />

        {/* What it makes — the creative range, shown with real output. */}
        <CreationsSection />

        {/* Scenarios */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <RevealOnScroll>
            <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-3">Live scenarios</p>
            <h2 className="text-4xl font-semibold text-text mb-2">See it in action.</h2>
            <p className="text-muted mb-10 text-base">Real situations. One message each. Watch how MODUS handles it.</p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            {/* Tab bar */}
            <div className="flex flex-wrap gap-2 mb-5">
              {TABS.map(tab => (
                <motion.button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand text-white shadow-lg shadow-brand/30'
                      : 'bg-panel text-muted hover:text-text hover:bg-text/[0.09]'
                  }`}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>

            {/* Chat window */}
            <div className="bg-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-text/[0.06] bg-bg/40">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <div className="flex-1 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-xs font-semibold text-muted/60 tracking-widest">MODUS</span>
                </div>
                <div className="w-[52px]" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <ScenarioPlayer tabId={activeTab} />
                </motion.div>
              </AnimatePresence>
            </div>
          </RevealOnScroll>
        </section>

        {/* The four generic "steps" cards lived here and were cut: they described
            a flow in words on a page whose job is to SHOW things. StackSection and
            CreationsSection now carry that weight with something to look at. */}

        {/* MODUS vs others */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <RevealOnScroll>
            <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-3">The difference</p>
            <h2 className="text-4xl font-semibold text-text mb-10">Other AI answers. MODUS acts.</h2>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <div className="bg-panel rounded-2xl overflow-hidden shadow-xl shadow-black/30">
              <div className="grid grid-cols-3 border-b border-text/[0.06] text-xs font-semibold uppercase tracking-wider">
                <div className="py-4 px-6 text-muted" />
                <div className="py-4 px-6 text-muted border-l border-text/[0.06]">ChatGPT / Claude</div>
                <div className="py-4 px-6 text-brand dark:text-brand-light border-l border-text/[0.06] bg-brand/[0.07]">MODUS</div>
              </div>
              {[
                { dim: 'Mode', them: 'You go to it. Open a tab, type a prompt.', us: 'It comes to you. Briefings, alerts, check-ins.' },
                { dim: 'Connected', them: 'Lives in a tab. No access to your real life.', us: 'Email, calendar, Notion, Slack, GitHub, all live.' },
                { dim: 'After chat', them: 'Conversation ends. No follow-through.', us: 'Tracks, follows up, checks in until done.' },
                { dim: 'Actions', them: 'Gives you advice. You do the work.', us: 'Approval card. One tap. It\'s done.' },
              ].map((row, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }} className="grid grid-cols-3 border-b border-text/[0.06] last:border-0">
                  <div className="py-5 px-6 text-sm font-semibold text-muted">{row.dim}</div>
                  <div className="py-5 px-6 text-sm text-muted leading-relaxed border-l border-text/[0.06]">{row.them}</div>
                  <div className="py-5 px-6 text-sm text-text leading-relaxed border-l border-text/[0.06] bg-brand/[0.07]">{row.us}</div>
                </motion.div>
              ))}
            </div>
          </RevealOnScroll>
        </section>

        {/* CTA */}
        <section className="px-6 py-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />
          <RevealOnScroll direction="none">
            <div className="relative max-w-2xl mx-auto space-y-6">
              <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest">Ready?</p>
              <h2 className="text-4xl md:text-5xl font-semibold text-text leading-tight">
                You&apos;re the executive.<br />
                <span className="text-brand dark:text-brand-light">MODUS handles the rest.</span>
              </h2>
              <p className="text-muted text-lg leading-relaxed">
                Tell MODUS what matters. It figures out how to make it happen.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link href="/login"
                  className="btn-primary inline-block px-10 py-4 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-100 text-base">
                  Start your 3-day free trial
                </Link>
                <Link href="/pricing"
                  className="inline-block px-10 py-4 bg-text/[0.06] text-muted hover:bg-text/10 hover:text-text rounded-xl transition-colors text-base">
                  See pricing
                </Link>
              </div>
              <p className="text-xs text-muted/50">Card required · Cancel anytime</p>
            </div>
          </RevealOnScroll>
        </section>

      </div>
    </div>
  );
}
