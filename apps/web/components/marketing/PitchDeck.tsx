'use client';

import DeckViewer from './DeckViewer';

function Stat({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-4xl sm:text-5xl font-black text-[#7c3aed] font-display">{value}</span>
      <span className="text-white/70 text-sm text-center leading-snug">{label}</span>
      {source && <span className="text-white/25 text-[10px] text-center">{source}</span>}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#a78bfa] text-xs font-medium">
      {children}
    </span>
  );
}

function SlideHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">{children}</h2>;
}

function Source({ children }: { children: React.ReactNode }) {
  return <span className="text-white/20 text-[10px]">{children}</span>;
}

/* ─── SLIDE 1 — COVER ────────────────────────────────────────── */
function Cover() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-8 w-full max-w-3xl mx-auto">
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-6xl sm:text-8xl font-black tracking-widest text-[#7c3aed]">MODUS</span>
        <span className="text-white/40 text-sm tracking-widest uppercase font-semibold">PILOT</span>
      </div>
      <p className="text-white/80 text-xl sm:text-2xl font-display font-semibold max-w-xl">
        The AI Operating System for Your Life
      </p>
      <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#7c3aed]/50 to-transparent" />
      <div className="flex flex-col items-center gap-2 text-sm text-white/40">
        <span className="text-white/60 font-medium">Jeremiah · Founder & CEO</span>
        <span>Pre-seed · Raising $500K · $5M cap SAFE</span>
        <span className="text-[#7c3aed]/80 mt-1">jeremiah@moduspilot.com</span>
      </div>
    </div>
  );
}

/* ─── SLIDE 2 — PROBLEM ──────────────────────────────────────── */
function Problem() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-3">
        <Tag>The Problem</Tag>
        <SlideHeading>1 billion knowledge workers.<br />8 in 10 overwhelmed every single day.</SlideHeading>
        <p className="text-white/50 text-lg mt-1">We have more AI tools than ever. We still feel behind.</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-2">
        {[
          { tool: 'ChatGPT', flaw: "Doesn't know you" },
          { tool: 'Notion', flaw: "Doesn't act" },
          { tool: 'Todo apps', flaw: 'Just adds more to manage' },
        ].map(({ tool, flaw }) => (
          <div key={tool} className="flex flex-col gap-2 p-4 rounded-xl border border-white/6 bg-white/[0.02]">
            <span className="text-white/50 font-semibold text-sm">{tool}</span>
            <span className="text-red-400/70 text-sm">{flaw}</span>
          </div>
        ))}
      </div>
      <p className="text-white/20 text-xs">Source: World Bank · Workplace productivity research 2025</p>
    </div>
  );
}

/* ─── SLIDE 3 — THE NUMBERS ──────────────────────────────────── */
function TheNumbers() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>The Data</Tag>
        <SlideHeading>The numbers don&apos;t lie.</SlideHeading>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Stat value="30×" label="App switches per day, per worker" source="Asana / Gartner" />
        <Stat value="60%" label="Work time spent on work about work" source="Asana State of Work" />
        <Stat value="21%" label="Employees truly engaged at work" source="Gallup 2025" />
        <Stat value="$438B" label="Lost to disengagement yearly" source="Gallup 2025" />
      </div>
      <div className="flex items-center gap-3 p-4 rounded-xl border border-white/6 bg-white/[0.02]">
        <span className="text-2xl">⚡</span>
        <p className="text-white/60 text-sm">Workers are interrupted <strong className="text-white/80">every 2 minutes</strong> during core work hours. 9.4 apps used daily. 26% say app overload makes them less efficient.</p>
      </div>
    </div>
  );
}

/* ─── SLIDE 4 — THE REAL PROBLEM ────────────────────────────── */
function RealProblem() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>The Real Problem</Tag>
        <SlideHeading>We&apos;ve been building smarter models.<br />Nobody built the infrastructure.</SlideHeading>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5">
          <span className="text-[#7c3aed] font-black text-2xl font-display">50×</span>
          <p className="text-white/60 text-sm">AI inference prices dropped 50× in 2 years</p>
          <Source>Skywork AI / Amadeus Capital 2025</Source>
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5">
          <span className="text-[#7c3aed] font-black text-2xl font-display">$30→$0.10</span>
          <p className="text-white/60 text-sm">GPT-4 level performance per million tokens</p>
          <Source>Skywork AI 2025</Source>
        </div>
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5">
          <span className="text-[#7c3aed] font-black text-2xl font-display">~0</span>
          <p className="text-white/60 text-sm">Difference users perceive between model versions for everyday tasks</p>
          <Source>Industry research</Source>
        </div>
      </div>
      <p className="text-white/50 text-base border-l-2 border-[#7c3aed]/50 pl-4">
        A chatbot is just text back and forth — no memory, no context, no action. The model was never the bottleneck.
      </p>
    </div>
  );
}

/* ─── SLIDE 5 — THE INSIGHT ──────────────────────────────────── */
function TheInsight() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-3xl mx-auto items-center text-center">
      <Tag>The Thesis</Tag>
      <blockquote className="flex flex-col gap-4">
        <p className="font-display text-2xl sm:text-4xl font-black text-white leading-tight">
          &ldquo;The era of who has the smartest AI is ending. Value moves to whoever controls
          <span className="text-[#7c3aed]"> the data and the user interface.</span>&rdquo;
        </p>
        <cite className="text-white/30 text-sm not-italic">— Amadeus Capital Research, 2025</cite>
      </blockquote>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#7c3aed]/30 to-transparent" />
      <div className="flex flex-col gap-3 items-center">
        <p className="text-white/60 text-lg font-semibold">MODUS is that infrastructure.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {['Personal Context', 'Memory', 'Integrations', 'Approval Flow'].map(t => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SLIDE 6 — SOLUTION ─────────────────────────────────────── */
function Solution() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>The Solution</Tag>
        <SlideHeading>MODUS defeats the chatbot paradigm.</SlideHeading>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-red-500/15 bg-red-500/[0.03]">
          <span className="text-red-400/60 font-semibold text-sm">A Chatbot</span>
          {['Text back and forth', 'Forgets you every conversation', "Doesn't know your goals", "Can't do anything", 'You have to remember to use it'].map(t => (
            <div key={t} className="flex items-start gap-2 text-white/30 text-sm">
              <span className="text-red-400/40 mt-0.5 shrink-0">✕</span>{t}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/[0.06]">
          <span className="text-[#a78bfa] font-semibold text-sm">MODUS</span>
          {['AI assistant + operating system', 'Persistent memory of your life', 'Knows your goals, inbox, calendar, habits', 'Acts on your behalf — you approve', 'Comes to you every morning'].map(t => (
            <div key={t} className="flex items-start gap-2 text-white/70 text-sm">
              <span className="text-[#7c3aed] mt-0.5 shrink-0">✓</span>{t}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-white/30 text-xs font-mono">
        {['Monitor', 'Decide', 'Approve', 'Execute'].map((step, i, arr) => (
          <span key={step} className="flex items-center gap-2">
            <span className="text-[#7c3aed]/80">{step}</span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── SLIDE 7 — PRODUCT: BRIEFING ───────────────────────────── */
function ProductBriefing() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>The Product</Tag>
        <SlideHeading>Every morning.<br />Here&apos;s what matters. Here&apos;s what you&apos;re missing.</SlideHeading>
      </div>
      {/* Screenshot placeholder */}
      <div className="w-full rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden aspect-video flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-4xl">📋</span>
          <span className="text-sm">Morning Briefing — app.moduspilot.com/briefing</span>
          <span className="text-xs">Replace with screenshot</span>
        </div>
      </div>
      <p className="text-white/40 text-sm text-center">Daily briefing: top priorities, inbox triage, calendar, habit check-ins, AI-generated focus plan</p>
    </div>
  );
}

/* ─── SLIDE 8 — PRODUCT: APPROVAL FLOW ─────────────────────── */
function ProductApproval() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>The Product</Tag>
        <SlideHeading>MODUS acts.<br />You approve. Nothing runs without you.</SlideHeading>
      </div>
      <div className="w-full rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden aspect-video flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-4xl">✅</span>
          <span className="text-sm">Chat + Approval Card — app.moduspilot.com/chat</span>
          <span className="text-xs">Replace with screenshot</span>
        </div>
      </div>
      <p className="text-white/40 text-sm text-center">MODUS drafts emails, schedules events, creates tasks, tracks goals — all surfaced as approval cards. You approve or edit. Every time.</p>
    </div>
  );
}

/* ─── SLIDE 9 — INTEGRATIONS ─────────────────────────────────── */
function Integrations() {
  const tools = [
    'Gmail', 'Google Calendar', 'Google Drive',
    'Notion', 'Slack', 'GitHub', 'Custom MCP Tools',
  ];
  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto items-center text-center">
      <div className="flex flex-col gap-2 items-center">
        <Tag>Integrations</Tag>
        <SlideHeading>Connected to your entire life.</SlideHeading>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {tools.map(t => (
          <div key={t} className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-white/60 text-sm font-medium">
            {t}
          </div>
        ))}
      </div>
      <p className="text-white/30 text-sm">Coming next: wearables, CRM, financial data, calendar + email providers beyond Google</p>
      <div className="flex items-center gap-2 p-3 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5">
        <span className="text-[#7c3aed] text-sm">MCP Protocol Support</span>
        <span className="text-white/30 text-xs">— connect any tool via custom MCP server. MODUS talks to everything.</span>
      </div>
    </div>
  );
}

/* ─── SLIDE 10 — MARKET ──────────────────────────────────────── */
function Market() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>Market Opportunity</Tag>
        <SlideHeading>Every knowledge worker on earth<br />is the customer.</SlideHeading>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2 p-5 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 items-center text-center">
          <span className="text-white/40 text-xs uppercase tracking-wider">AI Productivity Tools</span>
          <span className="font-display font-black text-2xl text-white">$13.6B → $115.85B</span>
          <span className="text-[#7c3aed] text-sm font-semibold">27.9% CAGR</span>
          <Source>Grand View Research / market.us</Source>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 items-center text-center">
          <span className="text-white/40 text-xs uppercase tracking-wider">AI Assistant Market</span>
          <span className="font-display font-black text-2xl text-white">$3.4B → $21.1B</span>
          <span className="text-[#7c3aed] text-sm font-semibold">44.5% CAGR by 2030</span>
          <Source>MarketsandMarkets</Source>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 items-center text-center">
          <span className="text-white/40 text-xs uppercase tracking-wider">TAM</span>
          <span className="font-display font-black text-2xl text-white">1B+</span>
          <span className="text-[#7c3aed] text-sm font-semibold">Knowledge workers globally</span>
          <Source>World Bank</Source>
        </div>
      </div>
      <p className="text-white/30 text-xs text-center">AI software market overall: $174.1B in 2025, growing at 25% CAGR through 2030 · ABI Research</p>
    </div>
  );
}

/* ─── SLIDE 11 — TRACTION ────────────────────────────────────── */
function Traction() {
  const shipped = [
    'Auth (Google OAuth + Apple)', 'AI Chat (streaming)', 'Goals + Tasks + Habits',
    'Daily Briefing (AI-generated)', 'Google Gmail/Calendar/Drive', 'Voice Input',
    'Vector Memory (Pinecone)', 'MCP Protocol', 'Shared Conversation Links', 'Subscriptions (Stripe)',
  ];
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>Traction</Tag>
        <SlideHeading>Week 1.</SlideHeading>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center gap-1 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 text-center">
          <span className="font-display font-black text-4xl text-[#7c3aed]">7</span>
          <span className="text-white/50 text-sm">Days to build</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 text-center">
          <span className="font-display font-black text-4xl text-[#7c3aed]">10+</span>
          <span className="text-white/50 text-sm">Early users</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 text-center">
          <span className="font-display font-black text-4xl text-[#7c3aed]">YC</span>
          <span className="text-white/50 text-sm">Applied</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {shipped.map(f => (
          <div key={f} className="flex items-center gap-2 text-white/40 text-xs">
            <span className="text-[#7c3aed] shrink-0">✓</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SLIDE 12 — BUSINESS MODEL ──────────────────────────────── */
function BusinessModel() {
  const plans = [
    { name: 'Free', price: '$0', desc: '30-day full trial, then 20 msg/day', highlight: false },
    { name: 'MODUS', price: '$24/mo', desc: 'Unlimited everything', highlight: true },
    { name: 'PILOT', price: '$59/mo', desc: 'Executives + wearables, CRM, financial data', highlight: false },
  ];
  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto items-center">
      <div className="flex flex-col gap-2 items-center text-center">
        <Tag>Business Model</Tag>
        <SlideHeading>Simple, recurring, scalable.</SlideHeading>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {plans.map(({ name, price, desc, highlight }) => (
          <div
            key={name}
            className={`flex flex-col gap-3 p-5 rounded-xl border text-center ${
              highlight
                ? 'border-[#7c3aed]/50 bg-[#7c3aed]/10'
                : 'border-white/8 bg-white/[0.02]'
            }`}
          >
            <span className={`font-semibold text-sm ${highlight ? 'text-[#a78bfa]' : 'text-white/50'}`}>{name}</span>
            <span className="font-display font-black text-2xl text-white">{price}</span>
            <span className="text-white/40 text-xs">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SLIDE 13 — WHY WE WIN ──────────────────────────────────── */
function WhyWeWin() {
  const competitors = ['ChatGPT', 'Notion', 'Superhuman', 'Todoist'];
  const rows = [
    { label: 'Knows you personally', modus: true, others: [false, false, false, false] },
    { label: 'Acts proactively', modus: true, others: [false, false, false, false] },
    { label: 'Full life context', modus: true, others: [false, false, false, false] },
    { label: 'Approval flow', modus: true, others: [false, false, false, false] },
    { label: 'Memory across sessions', modus: true, others: [false, false, false, false] },
    { label: 'One product for everything', modus: true, others: [false, false, false, false] },
  ];
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>Competitive Position</Tag>
        <SlideHeading>Nobody else is doing this.</SlideHeading>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-white/30 font-normal pb-3 pr-4" />
              <th className="text-center text-[#a78bfa] font-bold pb-3 px-3">MODUS</th>
              {competitors.map(c => (
                <th key={c} className="text-center text-white/30 font-normal pb-3 px-3">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, modus, others }) => (
              <tr key={label} className="border-t border-white/5">
                <td className="text-white/50 py-2.5 pr-4">{label}</td>
                <td className="text-center py-2.5 px-3">
                  {modus ? <span className="text-[#7c3aed]">✓</span> : <span className="text-red-400/40">✕</span>}
                </td>
                {others.map((v, i) => (
                  <td key={i} className="text-center py-2.5 px-3">
                    {v ? <span className="text-white/50">✓</span> : <span className="text-white/15">✕</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── SLIDE 14 — TEAM ────────────────────────────────────────── */
function Team() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <Tag>Team</Tag>
        <SlideHeading>Technical founder.<br />Knows distribution, product, and code.</SlideHeading>
      </div>
      <div className="flex gap-6 items-start">
        <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center text-2xl font-black text-[#7c3aed] font-display shrink-0">J</div>
        <div className="flex flex-col gap-4 flex-1">
          <div>
            <p className="text-white font-semibold">Jeremiah</p>
            <p className="text-white/40 text-sm">Founder & CEO · Los Angeles, CA · From the Mariana Islands</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Built MODUS solo in 1 week', icon: '⚡' },
              { label: 'Creative Director — The Maximo Marketing', icon: '🎯' },
              { label: '@OliverMoy & @NorthStarBoys — 2.5M+ followers, 1.5B+ views', icon: '📈' },
              { label: '@NetworkTeams — narrative lead, $100K MRR', icon: '💰' },
              { label: 'Web dev & strategy for 20+ companies', icon: '🌐' },
              { label: 'Startup work: Dipper & Ripple', icon: '🚀' },
            ].map(({ label, icon }) => (
              <div key={label} className="flex items-start gap-2 text-white/50 text-sm">
                <span className="shrink-0">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SLIDE 15 — THE ASK ─────────────────────────────────────── */
function TheAsk() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-3xl mx-auto items-center text-center">
      <div className="flex flex-col gap-2 items-center">
        <Tag>The Ask</Tag>
        <SlideHeading>Raising $500,000.</SlideHeading>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full">
        {[
          { label: 'Raise', value: '$500K' },
          { label: 'Valuation Cap', value: '$5M' },
          { label: 'Discount', value: '20%' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 p-4 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5">
            <span className="text-white/30 text-xs uppercase tracking-wider">{label}</span>
            <span className="font-display font-black text-2xl text-[#7c3aed]">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 text-white/40 text-sm">
        <p className="font-semibold text-white/60">Use of funds</p>
        <p>User acquisition · First engineering hire · Infrastructure scale</p>
      </div>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#7c3aed]/30 to-transparent" />
      <div className="flex flex-col gap-1 items-center">
        <a
          href="mailto:jeremiah@moduspilot.com"
          onClick={e => e.stopPropagation()}
          className="text-[#7c3aed] font-semibold text-lg hover:text-[#a78bfa] transition-colors"
        >
          jeremiah@moduspilot.com
        </a>
        <span className="text-white/30 text-sm">moduspilot.com</span>
      </div>
    </div>
  );
}

/* ─── DECK ───────────────────────────────────────────────────── */
const SLIDES = [
  <Cover key="cover" />,
  <Problem key="problem" />,
  <TheNumbers key="numbers" />,
  <RealProblem key="real-problem" />,
  <TheInsight key="insight" />,
  <Solution key="solution" />,
  <ProductBriefing key="briefing" />,
  <ProductApproval key="approval" />,
  <Integrations key="integrations" />,
  <Market key="market" />,
  <Traction key="traction" />,
  <BusinessModel key="biz" />,
  <WhyWeWin key="why" />,
  <Team key="team" />,
  <TheAsk key="ask" />,
];

export default function PitchDeck() {
  return <DeckViewer slides={SLIDES} label="Investor Deck" />;
}
