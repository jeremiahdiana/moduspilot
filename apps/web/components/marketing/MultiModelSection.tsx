'use client';

import { motion } from 'framer-motion';

// Wordmark badges (name + brand-tinted dot) — deliberately NOT copied brand
// logos, for accuracy + to avoid trademark asset issues.
const MODELS = [
  { name: 'Claude',  provider: 'Anthropic', color: '#D97757' },
  { name: 'GPT-4o',  provider: 'OpenAI',    color: '#10A37F' },
  { name: 'Gemini',  provider: 'Google',    color: '#4285F4' },
  { name: 'Grok',    provider: 'xAI',       color: '#6B7280' },
  { name: 'Llama',   provider: 'Meta',      color: '#0866FF' },
];

/* A truthful mock of the real in-chat model switcher (composer + open dropdown). */
function SwitcherMock() {
  return (
    <div className="relative bg-panel border border-border rounded-2xl p-4 shadow-xl shadow-brand/5">
      {/* composer row */}
      <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2.5 mb-3">
        <span className="text-sm text-muted/70 flex-1">Write me a cover letter…</span>
        <span className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
        </span>
      </div>

      {/* open model dropdown */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-brand/5 border-b border-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand">Auto</p>
            <p className="text-[11px] text-muted">MODUS picks the best model for each task</p>
          </div>
        </div>
        {MODELS.map(m => (
          <div key={m.name} className="flex items-center gap-2.5 px-3 py-2 border-b border-border/50 last:border-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
            <span className="text-sm font-medium text-text">{m.name}</span>
            <span className="text-[11px] text-muted">{m.provider}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MultiModelSection() {
  return (
    <section id="models" className="py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">One chat. Every model.</p>
            <h2 className="text-4xl md:text-5xl font-black text-text leading-tight mb-5">
              Write with Gemini.<br />Research with Claude.<br />Ask ChatGPT.
            </h2>
            <p className="text-muted text-base leading-relaxed mb-6">
              Every frontier model lives in one chat. Pick the one you want — or let MODUS
              <span className="text-text font-semibold"> route every task to the best model automatically</span>. Switch anytime, right in the composer.
            </p>

            {/* wordmark badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {MODELS.map(m => (
                <span key={m.name} className="inline-flex items-center gap-1.5 bg-panel border border-border rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-xs font-semibold text-text">{m.name}</span>
                </span>
              ))}
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
            <SwitcherMock />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
