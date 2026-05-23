'use client';

import { motion } from 'framer-motion';

export default function FinalCTA() {
  return (
    <section className="relative py-40 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-panel" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(124,58,237,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-text leading-tight mb-6">
            Your goals deserve more than<br />
            <span className="text-brand">another productivity app.</span>
          </h2>
          <p className="text-muted text-lg mb-10 max-w-xl mx-auto">
            MODUS runs the system. You make the calls. Start free — no credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className="inline-block px-10 py-4 bg-brand text-white text-base font-bold rounded-xl hover:bg-brand/90 hover:shadow-[0_0_60px_rgba(124,58,237,0.5)] transition-all hover:scale-105 active:scale-100"
            >
              Get Early Access
            </a>
            <a
              href="#features"
              className="inline-block px-10 py-4 border border-border text-muted text-base font-medium rounded-xl hover:border-brand/40 hover:text-text transition-all"
            >
              See how it works
            </a>
          </div>
          <p className="text-xs text-muted/40 mt-6">30-day free trial · No credit card · Cancel anytime</p>
        </motion.div>
      </div>
    </section>
  );
}
