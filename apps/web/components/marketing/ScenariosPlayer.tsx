'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Image from 'next/image';
import { useTabProgress } from '@/hooks/useTabProgress';
import { useHoverPause } from '@/hooks/useHoverPause';

/**
 * ScenariosPlayer — the "see it in action" chat player, self-contained so it can
 * live in a card. Six real situations, one message each, auto-playing and
 * handing off to the next. Lifted from the old features page.
 */

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function ModusAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
      <Image src="/logo.png" alt="MODUS" width={12} height={12} className="opacity-75" />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-end gap-2">
      <ModusAvatar />
      <div className="flex items-center gap-1 px-3.5 py-2.5 bg-panel rounded-2xl rounded-tl-sm w-fit">
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
      className={`flex items-end gap-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {role === 'modus' && <ModusAvatar />}
      <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
        role === 'user' ? 'bg-brand text-white rounded-br-sm' : 'bg-panel text-text rounded-tl-sm'
      }`}>
        {text}
      </div>
    </motion.div>
  );
}

function ActionCard({ actions, buttons }: { actions: { label: string; detail: string; badge?: string }[]; buttons?: string[] }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
      className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/10 ring-1 ring-brand/20">
      <div className="px-3.5 py-2.5 flex items-center gap-2 bg-brand/[0.07]">
        <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="text-[11px] font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Action set ready</span>
      </div>
      <div className="divide-y divide-text/[0.06]">
        {actions.map((a, i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-text font-medium">{a.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{a.detail}</p>
            </div>
            {a.badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${a.badge === 'Urgent' ? 'bg-red-500/20 text-red-400' : 'bg-brand/10 text-brand'}`}>{a.badge}</span>}
          </div>
        ))}
      </div>
      {buttons && (
        <div className="px-3.5 py-2.5 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-1.5 text-white text-[11px] font-semibold rounded-lg">{buttons[0]}</button>
          {buttons[1] && <button className="flex-1 py-1.5 bg-bg/80 text-muted text-[11px] font-semibold rounded-lg">{buttons[1]}</button>}
        </div>
      )}
    </motion.div>
  );
}

const TABS = [
  { id: 'morning', label: 'Morning' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'sales', label: 'Sales goal' },
  { id: 'goal', label: 'Set a goal' },
  { id: 'inbox', label: 'Inbox triage' },
  { id: 'memory', label: 'Memory' },
];

type SceneItem =
  | { type: 'msg'; role: 'modus' | 'user'; text: string; delay: number }
  | { type: 'thinking'; delay: number }
  | { type: 'card'; delay: number; component: React.ReactNode };

const SCENES: Record<string, SceneItem[]> = {
  morning: [
    { type: 'msg', role: 'modus', text: "Good morning. You slept 7h 20m and you're already at 2,400 steps, so this is a good energy day. You have 3 emails that need replies, one meeting at 2 PM, and two tasks still open. I've queued up an action set.", delay: 400 },
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
    { type: 'msg', role: 'modus', text: "Got it. Based on your workload and schedule, here's how I'd break that down, and I'll track it week by week.", delay: 1700 },
    { type: 'card', delay: 2600, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/10 ring-1 ring-brand/20">
        <div className="px-3.5 py-2.5 bg-brand/[0.07]">
          <span className="text-[11px] font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Goal plan · $10k this month</span>
        </div>
        <div className="p-3.5 space-y-2.5">
          {[
            { week: 'Week 1', title: 'Reach out to 20 prospects', note: 'Daily outreach reminder at 9 AM' },
            { week: 'Week 2', title: 'Book 5 discovery calls', note: 'Calendar blocks + prep briefs' },
            { week: 'Week 3', title: 'Close 2 deals, follow up on the rest', note: 'MODUS flags cold leads' },
            { week: 'Week 4', title: 'Invoice, collect, and review', note: 'Invoices drafted + summary sent' },
          ].map((w, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full h-fit mt-0.5 shrink-0">{w.week}</span>
              <div><p className="text-[13px] text-text">{w.title}</p><p className="text-[11px] text-muted">{w.note}</p></div>
            </div>
          ))}
        </div>
        <div className="px-3.5 py-2.5 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-1.5 text-white text-[11px] font-semibold rounded-lg">Approve plan</button>
          <button className="flex-1 py-1.5 bg-bg/80 text-muted text-[11px] font-semibold rounded-lg">Adjust</button>
        </div>
      </motion.div>
    ) },
  ],
  inbox: [
    { type: 'msg', role: 'modus', text: "You woke up to 47 emails. I've gone through them. Only 3 actually need you. I've drafted replies for all of them.", delay: 400 },
    { type: 'msg', role: 'user', text: "Show me what needs my attention.", delay: 1200 },
    { type: 'thinking', delay: 2000 },
    { type: 'card', delay: 2800, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/10 ring-1 ring-brand/20">
        <div className="px-3.5 py-2.5 bg-brand/[0.07]">
          <p className="text-[11px] font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Needs your reply today (3)</p>
        </div>
        {[
          { from: 'Alex', subject: '"Contract ready to sign"', badge: 'Reply drafted', urgent: false },
          { from: 'Marcus', subject: '"Quick question on the deck"', badge: 'Reply drafted', urgent: false },
          { from: 'Your accountant', subject: '"Invoice overdue"', badge: 'Urgent', urgent: true },
        ].map((e, i) => (
          <div key={i} className="px-3.5 py-2.5 border-b border-text/[0.06] flex items-center justify-between gap-3">
            <div><p className="text-[13px] text-text font-medium">{e.from}</p><p className="text-[11px] text-muted">{e.subject}</p></div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${e.urgent ? 'bg-red-500/20 text-red-400' : 'bg-brand/10 text-brand'}`}>{e.badge}</span>
          </div>
        ))}
        <div className="px-3.5 py-2.5 flex gap-2">
          <button className="btn-primary flex-1 py-1.5 text-white text-[11px] font-semibold rounded-lg">Approve all 3</button>
          <button className="flex-1 py-1.5 bg-bg/80 text-muted text-[11px] font-semibold rounded-lg">Review drafts</button>
        </div>
      </motion.div>
    ) },
  ],
  memory: [
    { type: 'msg', role: 'modus', text: "Something came up in your memory from 3 weeks ago that I think is worth revisiting.", delay: 400 },
    { type: 'card', delay: 1200, component: (
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="bg-panel rounded-2xl overflow-hidden shadow-lg shadow-black/10 ring-1 ring-brand/25">
        <div className="px-3.5 py-2.5 bg-brand/[0.07]">
          <span className="text-[11px] font-semibold text-brand dark:text-brand-light uppercase tracking-wider">Memory · 3 weeks ago</span>
        </div>
        <div className="px-3.5 py-3.5 space-y-2.5">
          <p className="text-[13px] text-text italic">"I think I want to pivot my offer and go more premium by Q3."</p>
          <p className="text-[11px] text-muted">You said this 3 weeks ago and it hasn't come up since.</p>
          <p className="text-[13px] text-brand font-medium">It's week 6 of Q2. Want to start building that out now?</p>
        </div>
        <div className="px-3.5 py-2.5 border-t border-text/[0.06] flex gap-2">
          <button className="btn-primary flex-1 py-1.5 text-white text-[11px] font-semibold rounded-lg">Yes, let's plan it</button>
          <button className="flex-1 py-1.5 bg-bg/80 text-muted text-[11px] font-semibold rounded-lg">Not yet</button>
        </div>
      </motion.div>
    ) },
  ],
};

const CARD_FADE_MS = 400;
const SCENE_HOLD_MS = 1400;
function sceneMs(tabId: string): number {
  const scene = SCENES[tabId] ?? [];
  return scene.reduce((max, s) => Math.max(max, s.delay), 0) + CARD_FADE_MS + SCENE_HOLD_MS;
}

function ScenarioPlayer({ tabId, replayKey }: { tabId: string; replayKey: number }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleCount(0); setShowThinking(false);
    const scene = SCENES[tabId] ?? [];
    let msgIdx = 0;
    scene.forEach(item => {
      if (item.type === 'thinking') {
        timeoutsRef.current.push(setTimeout(() => setShowThinking(true), item.delay));
      } else {
        const idx = msgIdx++;
        timeoutsRef.current.push(setTimeout(() => { setShowThinking(false); setVisibleCount(idx + 1); }, item.delay));
      }
    });
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [tabId, replayKey]);

  const scene = SCENES[tabId] ?? [];
  const renderItems = scene.filter(s => s.type !== 'thinking');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleCount, showThinking]);

  return (
    <div className="relative">
      {/* Short scenes centre instead of hanging off the bottom edge (two messages
          in a 430px well left a wall of dead space); long ones still overflow and
          the auto-scroll keeps the newest beat in frame. */}
      <div ref={scrollRef} className="h-[382px] overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center space-y-2.5 p-4 pb-6">
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
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-panel to-transparent pointer-events-none" />
    </div>
  );
}

export default function ScenariosPlayer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-100px 0px' });
  const [activeTab, setActiveTab] = useState('morning');
  const { paused, handlers } = useHoverPause();
  const [runId, setRunId] = useState(0);
  useEffect(() => { if (inView) setRunId(r => r + 1); }, [inView]);

  const runKey = `${activeTab}-${runId}`;
  const holdMs = sceneMs(activeTab);

  const fillRef = useTabProgress(
    holdMs,
    paused || !inView,
    runKey,
    () => {
      const i = TABS.findIndex(t => t.id === activeTab);
      setActiveTab(TABS[(i + 1) % TABS.length].id);
    },
  );

  return (
    <div ref={ref}>
      <div className="flex flex-wrap justify-center gap-1 mb-3" {...handlers}>
        {TABS.map(tab => {
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative overflow-hidden px-2 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                on ? 'text-white' : 'bg-panel text-muted hover:text-text'
              }`}
            >
              {on && (
                <>
                  <span className="absolute inset-0 bg-brand/25" />
                  <span ref={fillRef} className="absolute inset-y-0 left-0 bg-brand tab-fill" />
                </>
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-panel rounded-2xl border border-border overflow-hidden shadow-[0_16px_40px_-20px_rgba(30,20,60,0.25)]">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-text/[0.06] bg-bg/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-[11px] font-semibold text-muted/60 tracking-widest">MODUS</span>
          </div>
          <div className="w-[46px]" />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ScenarioPlayer tabId={activeTab} replayKey={runId} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
