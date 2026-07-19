'use client';

import { motion } from 'framer-motion';
import { MODEL_LOGOS } from './ModelLogos';
import { DemoWindow } from './ModelDemo';

export default function MultiModelSection() {
  return (
    <section id="models" className="py-28 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Centered header, using the full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">One chat. Every model.</p>
          <h2 className="text-4xl md:text-6xl font-semibold text-text leading-[1.1] tracking-tight mb-5">
            <span className="block whitespace-normal sm:whitespace-nowrap">Write with Gemini.</span>
            <span className="block whitespace-normal sm:whitespace-nowrap">Research with Claude.</span>
            <span className="block whitespace-normal sm:whitespace-nowrap">Ask ChatGPT.</span>
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Every frontier model lives in one chat. Pick the one you want, or leave it on
            <span className="text-text font-semibold"> Auto</span> and MODUS routes each task to whichever model is best. Switch anytime, right in the composer.
          </p>

          {/* model badges with real logos */}
          <div className="flex flex-wrap justify-center gap-2 mt-7">
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
        </motion.div>

        {/* Wide demo window */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-4xl mx-auto"
        >
          <DemoWindow />
        </motion.div>

        <p className="text-center text-sm text-muted mt-6 max-w-2xl mx-auto">
          <span className="text-text font-medium">PILOT</span> adds the frontier models (GPT-5.6 Sol, Claude Opus) with manual pick per message.
        </p>

        {/* First-scroll conversion: a cold visitor gets a clear trial CTA right here */}
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
