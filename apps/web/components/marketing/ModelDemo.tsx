'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { MODEL_LOGOS, ClaudeLogo, GeminiLogo, OpenAILogo, GrokLogo } from './ModelLogos';

// ─── Rich reply renderers ───────────────────────────────────────────────────
// Each demo answers with real, formatted output (not a flat sentence) so the
// demo actually shows what MODUS can produce: drafts, tables, charts, generated
// images, code, checklists. All self-contained: no APIs, no assets. Shared by
// the marketing MultiModelSection and the onboarding showcase.

function EmailReply({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="w-full">
      <div className="pb-2 mb-2.5">
        <p className="text-[11px] text-muted">To: Sarah Chen · <span className="text-brand">Draft ready</span></p>
        <p className="text-sm font-semibold text-text mt-0.5">{subject}</p>
      </div>
      <p className="text-sm text-text/90 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

function TableReply() {
  const cols = ['State', 'Credit', 'Notes'];
  const rows = [
    ['CA', '$7,500 + $2,000', 'Income-capped'],
    ['TX', '$7,500', 'No annual EV fee'],
    ['NY', '$7,500 + $2,000', 'Stackable, federal'],
  ];
  return (
    <div className="w-full">
      <p className="text-sm text-text/90 mb-2.5">Here&apos;s the 2026 breakdown, federal credit plus each state&apos;s rebate:</p>
      <div className="overflow-x-auto rounded-lg bg-bg/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-brand/5">
              {cols.map(c => (
                <th key={c} className="px-3 py-2 font-semibold text-muted whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={ri < rows.length - 1 ? 'bg-text/[0.02]' : ''}>
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 whitespace-nowrap ${ci === 0 ? 'font-semibold text-text' : 'text-text/80'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartReply() {
  const bars = [
    { m: 'Feb', v: 12 }, { m: 'Mar', v: 18 }, { m: 'Apr', v: 24 },
    { m: 'May', v: 31 }, { m: 'Jun', v: 38 }, { m: 'Jul', v: 47 },
  ];
  const max = 47;
  return (
    <div className="w-full">
      <p className="text-xs font-semibold text-text mb-0.5">MRR, last 6 months</p>
      <p className="text-[11px] text-muted mb-3">+292% · $12k → $47k</p>
      <div className="flex items-end gap-2 h-28">
        {bars.map((b, idx) => (
          <div key={b.m} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <span className="text-[9px] font-medium text-muted">${b.v}k</span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(b.v / max) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.06 * idx, ease: 'easeOut' }}
              className="w-full rounded-t-md bg-gradient-to-t from-brand/50 to-brand"
            />
            <span className="text-[9px] text-muted">{b.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageReply() {
  return (
    <div className="w-full">
      <p className="text-sm text-text/90 mb-2.5">Done. Here&apos;s a launch hero, dark and violet:</p>
      <div className="relative aspect-[16/9] w-full max-w-sm rounded-xl overflow-hidden bg-[#0a0a12]">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 28% 18%, rgba(124,58,237,0.6), transparent 60%), radial-gradient(100% 100% at 82% 92%, rgba(192,132,252,0.4), transparent 55%)' }} />
        <div className="absolute left-0 right-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(to top, rgba(124,58,237,0.45), transparent)' }} />
        <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)', backgroundSize: '26px 26px' }} />
        <div className="absolute w-20 h-20 rounded-full blur-2xl" style={{ top: '22%', left: '52%', background: 'rgba(216,180,254,0.75)' }} />
        <div className="absolute w-10 h-10 rounded-full blur-md" style={{ top: '30%', left: '58%', background: 'rgba(245,240,255,0.9)' }} />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-muted">Generated · 1024×1024</span>
        <span className="text-muted/50">·</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Download
        </span>
      </div>
    </div>
  );
}

function CodeReply() {
  return (
    <div className="w-full">
      <p className="text-sm text-text/90 mb-2.5">
        That&apos;s <span className="font-semibold text-text">StrictMode</span> double-invoking effects in dev to surface bugs. It won&apos;t happen in production. Add a cleanup to be safe:
      </p>
      <pre className="rounded-lg bg-[#0d0d14] p-3 overflow-x-auto">
        <code className="text-[11.5px] leading-relaxed font-mono">
          <span className="text-[#6b7280]">{'// runs twice in dev only, cleanup handles it'}</span>{'\n'}
          <span className="text-[#c084fc]">useEffect</span>{'(() => {\n'}
          {'  '}<span className="text-[#a78bfa]">const</span>{' ctrl = '}<span className="text-[#a78bfa]">new</span>{' '}<span className="text-[#7dd3fc]">AbortController</span>{'();\n'}
          {'  '}<span className="text-[#7dd3fc]">fetchData</span>{'({ signal: ctrl.signal });\n'}
          {'  '}<span className="text-[#a78bfa]">return</span>{' () => ctrl.'}<span className="text-[#7dd3fc]">abort</span>{'();\n'}
          {'}, []);'}
        </code>
      </pre>
    </div>
  );
}

function ChecklistReply() {
  const items = ['Stripe Atlas: file the C-corp (~$500)', 'EIN + bylaws + stock issuance included', '83(b) election prep in the same flow', 'Bank + cap table ready in 2-3 days'];
  return (
    <div className="w-full">
      <p className="text-sm text-text/90 mb-2.5">Fastest path: <span className="font-semibold text-text">Stripe Atlas</span>, done in 2-3 days:</p>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.08 * idx }}
            className="flex items-center gap-2.5"
          >
            <span className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5 text-brand">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <span className="text-sm text-text/90">{it}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Demo data ───────────────────────────────────────────────────────────────
type Demo = {
  prompt: string;
  Logo: (p: { className?: string }) => ReactNode;
  model: string;
  reason: string;
  render: () => ReactNode;
};

const DEMOS: Demo[] = [
  {
    prompt: 'Write a cold email to a VC who passed on us 6 months ago.',
    Logo: GeminiLogo, model: 'Gemini', reason: 'natural writing',
    render: () => (
      <EmailReply
        subject="We're a different company than 6 months ago"
        body={'Hi Sarah, last we spoke we were pre-revenue.\n\nSince then: $47k MRR, a team of 8, and two of your portfolio founders now use us daily. Worth a fresh look?'}
      />
    ),
  },
  {
    prompt: 'Compare the 2026 EV tax credits in CA, TX, and NY.',
    Logo: ClaudeLogo, model: 'Claude', reason: 'analysis & research',
    render: () => <TableReply />,
  },
  {
    prompt: 'Generate a launch hero image: dark, violet, futuristic.',
    Logo: OpenAILogo, model: 'GPT-4o', reason: 'image generation',
    render: () => <ImageReply />,
  },
  {
    prompt: 'Chart our MRR for the last 6 months.',
    Logo: ClaudeLogo, model: 'Claude', reason: 'data & analysis',
    render: () => <ChartReply />,
  },
  {
    prompt: 'Why does my useEffect run twice in React 18?',
    Logo: GrokLogo, model: 'Grok', reason: 'code & debugging',
    render: () => <CodeReply />,
  },
  {
    prompt: "What's the fastest way to incorporate a Delaware C-corp?",
    Logo: OpenAILogo, model: 'GPT-4o', reason: 'general knowledge',
    render: () => <ChecklistReply />,
  },
];

/**
 * The animated multi-model demo window: a fake chat that cycles prompts →
 * "MODUS routed this to <model>" → a rich, formatted reply. Self-contained,
 * scripted ($0). Reused by the marketing section + onboarding showcase.
 */
export function DemoWindow({ showRail = true, compact = false }: { showRail?: boolean; compact?: boolean } = {}) {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0); // 0 prompt, 1 routing, 2 reply

  useEffect(() => {
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 900);
    const t2 = setTimeout(() => setStage(2), 2100);
    const t3 = setTimeout(() => setI(x => (x + 1) % DEMOS.length), 7200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [i]);

  const d = DEMOS[i];
  const Logo = d.Logo;

  return (
    <div className="bg-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/40 w-full">
      {/* window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-panel rounded-lg px-4 py-1 text-[11px] text-muted/60 font-mono">
            moduspilot.com/chat
          </div>
        </div>
        <div className="w-[56px]" />
      </div>

      <div className={`flex ${compact ? 'min-h-[300px]' : 'min-h-[480px]'}`}>
        {/* model rail (real switcher) */}
        <div className={`w-56 shrink-0 bg-bg/40 p-3 ${showRail ? 'hidden md:flex' : 'hidden'} flex-col gap-1`}>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-2 pb-1">Model</p>
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-brand/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand leading-tight">Auto</p>
              <p className="text-[10px] text-muted leading-tight">picks the best model</p>
            </div>
          </div>
          <div className="my-1 h-px bg-text/[0.06]" />
          {MODEL_LOGOS.map(m => {
            const M = m.logo;
            const active = m.name === d.model;
            return (
              <motion.div
                key={m.name}
                animate={active ? { scale: 1.02 } : { scale: 1 }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                  active ? 'bg-brand/10' : ''
                }`}
              >
                <M className="w-4 h-4 shrink-0" />
                <span className={`text-sm flex-1 ${active ? 'text-text font-semibold' : 'text-muted'}`}>{m.name}</span>
                {active && (
                  <motion.span
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-brand"
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* conversation */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-start gap-3.5 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3.5"
            >
              {/* user prompt */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-end">
                <div className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-sm leading-relaxed">{d.prompt}</p>
                </div>
              </motion.div>

              {/* routing chip */}
              {stage >= 1 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-2 self-start flex-wrap">
                  <span className="text-[11px] text-muted">MODUS routed this to</span>
                  <span className="inline-flex items-center gap-1.5 bg-brand/10 rounded-full pl-1.5 pr-2.5 py-1">
                    <Logo className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold text-text">{d.model}</span>
                  </span>
                  <span className="text-[11px] text-muted/70">· best for {d.reason}</span>
                </motion.div>
              )}

              {/* reply */}
              {stage >= 2 ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex justify-start">
                  <div className="bg-bg rounded-2xl rounded-bl-sm px-4 py-3 w-full max-w-[95%]">
                    {d.render()}
                  </div>
                </motion.div>
              ) : stage >= 1 && (
                <div className="flex gap-1 self-start pl-1">
                  <span className="typing-dot w-1.5 h-1.5 bg-brand/50 rounded-full" />
                  <span className="typing-dot w-1.5 h-1.5 bg-brand/50 rounded-full" />
                  <span className="typing-dot w-1.5 h-1.5 bg-brand/50 rounded-full" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* progress dots */}
      <div className="flex items-center justify-center gap-1.5 py-3">
        {DEMOS.map((_, idx) => (
          <span key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === i ? 'w-5 bg-brand' : 'w-1.5 bg-text/15'}`} />
        ))}
      </div>
    </div>
  );
}
