'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { MODEL_LOGOS } from './ModelLogos';
import ModelCompareDemo from './ModelCompareDemo';

export default function MultiModelSection() {
  return (
    <section id="models" className="py-24 sm:py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">One chat. Every model.</p>
          <h2 className="text-4xl md:text-5xl text-text leading-[1.1] tracking-tight mb-5">
            Every AI, one conversation
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Stop paying for five apps and pasting between them. Claude, GPT-5.6, Gemini, Llama and DeepSeek all live in a single chat.
          </p>

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

        {/* Two-panel "how it helps" */}
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Left: ask all at once */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="rounded-2xl border border-border bg-panel/60 p-6 sm:p-7"
          >
            <h3 className="text-xl text-text mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
              Ask them all at once
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-5">
              One prompt, several models answer side by side — then MODUS tells you which one won.
            </p>
            <ModelCompareDemo />
          </motion.div>

          {/* Right: pick one mid-chat */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
            className="rounded-2xl border border-border bg-panel/60 p-6 sm:p-7"
          >
            <h3 className="text-xl text-text mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
              Or pick one, mid-chat
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Switch models right in the composer. Or leave it on <span className="text-text font-semibold">Auto</span> and MODUS routes each task to whichever model is best.
            </p>
            <div className="rounded-xl border border-border overflow-hidden shadow-[0_16px_40px_-20px_rgba(30,20,60,0.25)]">
              <Image
                src="/screenshot-models.png"
                alt="The MODUS model picker — choose Claude, GPT, Gemini and more per message"
                width={1200}
                height={800}
                className="w-full h-auto"
              />
            </div>
          </motion.div>
        </div>

        <p className="text-center text-sm text-muted mt-8 max-w-2xl mx-auto">
          <span className="text-text font-medium">MODUS</span> ($24) gives you every provider, auto-routed. <span className="text-text font-medium">PILOT</span> ($59) adds the frontier models — GPT-5.6 Sol, Claude Opus, Gemini 3.1 Pro — with manual pick per message.
        </p>

        {/* First-scroll conversion */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <a
            href="/login"
            className="btn-primary group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-white text-sm font-bold hover:scale-[1.02] active:scale-100 transition-transform"
          >
            Start your 3-day free trial
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
          <p className="text-xs text-muted">3 days free · card required · cancel anytime</p>
        </motion.div>
      </div>
    </section>
  );
}
