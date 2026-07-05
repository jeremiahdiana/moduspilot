'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { MODEL_LOGOS, ClaudeLogo, GeminiLogo, OpenAILogo, GrokLogo } from './ModelLogos';

// Auto-cycling demo — matches the motto (write→Gemini, research→Claude,
// ask→ChatGPT). Each cycle stages in: prompt → routing chip → reply.
const DEMOS = [
  { prompt: 'Write me a cover letter',        Logo: GeminiLogo, model: 'Gemini',  reply: 'On it — drafting something that sounds human, not AI.' },
  { prompt: 'Research the 2026 EV market',    Logo: ClaudeLogo, model: 'Claude',  reply: 'Pulling live sources and summarizing the landscape.' },
  { prompt: 'What should I focus on today?',  Logo: OpenAILogo, model: 'ChatGPT', reply: 'Your top 3 — starting with the investor reply.' },
  { prompt: 'Debug this Python function',     Logo: GrokLogo,   model: 'Grok',    reply: 'Found it — an off-by-one on line 14. Here\'s the fix.' },
];

function ModelDemo() {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0); // 0 = prompt, 1 = routing, 2 = reply

  useEffect(() => {
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 800);
    const t2 = setTimeout(() => setStage(2), 1800);
    const t3 = setTimeout(() => setI(x => (x + 1) % DEMOS.length), 4400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [i]);

  const d = DEMOS[i];
  const Logo = d.Logo;

  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-xl shadow-brand/5">
      {/* window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          <span className="text-[11px] font-semibold text-muted/60 tracking-widest">MODUS</span>
        </div>
        <div className="w-[46px]" />
      </div>

      {/* conversation */}
      <div className="h-[300px] p-5 flex flex-col justify-center gap-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            {/* user prompt */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-end">
              <div className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                <p className="text-sm">{d.prompt}</p>
              </div>
            </motion.div>

            {/* routing chip */}
            {stage >= 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-2 self-start">
                <span className="text-[11px] text-muted">Routed to</span>
                <span className="inline-flex items-center gap-1.5 bg-brand/5 border border-brand/20 rounded-full pl-1.5 pr-2.5 py-1">
                  <Logo className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold text-text">{d.model}</span>
                </span>
              </motion.div>
            )}

            {/* reply */}
            {stage >= 2 ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-start">
                <div className="bg-bg border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-sm text-text">{d.reply}</p>
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

      {/* progress dots */}
      <div className="flex items-center justify-center gap-1.5 pb-4">
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
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">One chat. Every model.</p>
            <h2 className="text-4xl md:text-5xl font-black text-text leading-[1.12] tracking-tight mb-5">
              <span className="block whitespace-nowrap">Write with Gemini.</span>
              <span className="block whitespace-nowrap">Research with Claude.</span>
              <span className="block whitespace-nowrap">Ask ChatGPT.</span>
            </h2>
            <p className="text-muted text-base leading-relaxed mb-6">
              Every frontier model lives in one chat. Pick the one you want — or let MODUS
              <span className="text-text font-semibold"> route every task to the best model automatically</span>. Switch anytime, right in the composer.
            </p>

            {/* model badges with real logos */}
            <div className="flex flex-wrap gap-2 mb-6">
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

            <div className="flex items-start gap-2 text-sm text-muted">
              <span className="text-brand mt-0.5 shrink-0">✦</span>
              <span><span className="text-text font-medium">PILOT</span> unlocks every model — Claude, GPT-4o, Gemini, Grok, o4-mini — with manual pick per message.</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <ModelDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
