'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { MODEL_LOGOS, ClaudeLogo, GeminiLogo, OpenAILogo, GrokLogo } from './ModelLogos';

// Auto-cycling demo — realistic prompts, real routed models, believable answers.
// Matches the motto (write→Gemini, research→Claude, ask→GPT, code→Grok).
const DEMOS = [
  {
    prompt: 'Write a cold email to a VC who passed on us 6 months ago.',
    Logo: GeminiLogo, model: 'Gemini', reason: 'natural, human writing',
    reply: 'Subject: We’re a different company than 6 months ago\n\nHi Sarah — last we spoke we were pre-revenue. Since then: $40k MRR, a team of 8, and two of your portfolio founders now use us daily. Worth a fresh look?',
  },
  {
    prompt: 'Compare the 2026 EV tax credits in CA, TX, and NY.',
    Logo: ClaudeLogo, model: 'Claude', reason: 'analysis & research',
    reply: 'CA — up to $7,500 federal + a $2,000 state rebate (income-capped).\nTX — federal only, but no annual EV fee.\nNY — $2,000 Drive Clean rebate, stackable with federal. Full table with the income limits below.',
  },
  {
    prompt: 'What’s the fastest way to incorporate a Delaware C-corp?',
    Logo: OpenAILogo, model: 'GPT-4o', reason: 'general knowledge',
    reply: 'Stripe Atlas or Clerky — about $500 and ready in 2–3 days. You get your EIN, bylaws, stock issuance, and 83(b) filing prep in one flow. Want the step-by-step checklist?',
  },
  {
    prompt: 'Why does my useEffect run twice in React 18?',
    Logo: GrokLogo, model: 'Grok', reason: 'code & debugging',
    reply: 'That’s StrictMode intentionally double-invoking effects in dev to surface bugs — it won’t happen in production. If it’s causing real side effects, add a cleanup function or an AbortController.',
  },
];

function Demo() {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0); // 0 prompt, 1 routing, 2 reply

  useEffect(() => {
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 900);
    const t2 = setTimeout(() => setStage(2), 2100);
    const t3 = setTimeout(() => setI(x => (x + 1) % DEMOS.length), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [i]);

  const d = DEMOS[i];
  const Logo = d.Logo;

  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl shadow-brand/10 w-full">
      {/* window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-panel border border-border rounded-lg px-4 py-1 text-[11px] text-muted/60 font-mono">
            moduspilot.com/chat
          </div>
        </div>
        <div className="w-[56px]" />
      </div>

      <div className="flex min-h-[420px]">
        {/* model rail (real switcher) */}
        <div className="w-56 shrink-0 border-r border-border bg-bg/30 p-3 hidden md:flex flex-col gap-1">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-2 pb-1">Model</p>
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-brand/10 border border-brand/25">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand leading-tight">Auto</p>
              <p className="text-[10px] text-muted leading-tight">picks the best model</p>
            </div>
          </div>
          <div className="my-1 border-t border-border/60" />
          {MODEL_LOGOS.map(m => {
            const M = m.logo;
            const active = m.name === d.model;
            return (
              <motion.div
                key={m.name}
                animate={active ? { scale: 1.02 } : { scale: 1 }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                  active ? 'bg-brand/5 border-brand/40' : 'border-transparent'
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
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-center gap-3.5 min-w-0">
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
                  <span className="inline-flex items-center gap-1.5 bg-brand/5 border border-brand/25 rounded-full pl-1.5 pr-2.5 py-1">
                    <Logo className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold text-text">{d.model}</span>
                  </span>
                  <span className="text-[11px] text-muted/70">· best for {d.reason}</span>
                </motion.div>
              )}

              {/* reply */}
              {stage >= 2 ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex justify-start">
                  <div className="bg-bg border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[92%]">
                    <p className="text-sm text-text leading-relaxed whitespace-pre-line">{d.reply}</p>
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
      <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border">
        {DEMOS.map((_, idx) => (
          <span key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === i ? 'w-5 bg-brand' : 'w-1.5 bg-border'}`} />
        ))}
      </div>
    </div>
  );
}

export default function MultiModelSection() {
  return (
    <section id="models" className="py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Centered header — uses the full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">One chat. Every model.</p>
          <h2 className="text-4xl md:text-6xl font-black text-text leading-[1.1] tracking-tight mb-5">
            <span className="block whitespace-normal sm:whitespace-nowrap">Write with Gemini.</span>
            <span className="block whitespace-normal sm:whitespace-nowrap">Research with Claude.</span>
            <span className="block whitespace-normal sm:whitespace-nowrap">Ask ChatGPT.</span>
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Every frontier model lives in one chat. Pick the one you want — or leave it on
            <span className="text-text font-semibold"> Auto</span> and MODUS routes each task to whichever model is best. Switch anytime, right in the composer.
          </p>

          {/* model badges with real logos */}
          <div className="flex flex-wrap justify-center gap-2 mt-7">
            {MODEL_LOGOS.map(m => {
              const Logo = m.logo;
              return (
                <span key={m.name} className="inline-flex items-center gap-1.5 bg-panel border border-border rounded-full pl-2 pr-3 py-1.5">
                  <Logo className="w-4 h-4" />
                  <span className="text-xs font-semibold text-text">{m.name}</span>
                </span>
              );
            })}
          </div>
        </motion.div>

        {/* Wide demo window */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-4xl mx-auto"
        >
          <Demo />
        </motion.div>

        <p className="text-center text-sm text-muted mt-6 max-w-2xl mx-auto">
          <span className="text-brand">✦</span> <span className="text-text font-medium">PILOT</span> unlocks every model — Claude, GPT-4o, Gemini, Grok, o4-mini — with manual pick per message.
        </p>
      </div>
    </section>
  );
}
