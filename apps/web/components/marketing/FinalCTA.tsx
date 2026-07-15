'use client';

import { motion } from 'framer-motion';

export default function FinalCTA() {
  return (
    <section className="relative py-40 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,15,20,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,15,20,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      {/* Single restrained purple bloom behind the closing statement */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_50%_50%,rgba(124,58,237,0.10),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text leading-tight mb-6">
            Your goals deserve more than<br />
            <span className="text-brand dark:text-brand-light">another productivity app.</span>
          </h2>
          <p className="text-muted text-lg mb-10 max-w-xl mx-auto">
            MODUS runs the system. You make the calls. Try it free for 3 days.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className="btn-primary inline-block px-10 py-4 bg-brand text-white text-base font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-100"
            >
              Start your 3-day free trial
            </a>
            <a
              href="/features"
              className="inline-block px-10 py-4 bg-text/[0.06] text-muted text-base font-medium rounded-xl hover:bg-text/10 hover:text-text transition-colors"
            >
              See how it works
            </a>
          </div>
          <p className="text-xs text-muted/40 mt-6">3-day free trial · Card required · Cancel anytime</p>
        </motion.div>
      </div>
    </section>
  );
}
