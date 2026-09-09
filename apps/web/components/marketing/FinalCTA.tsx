'use client';

import { motion } from 'framer-motion';

export default function FinalCTA() {
  return (
    <section className="relative py-32 sm:py-40 px-6 border-t border-border">
      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-4xl md:text-6xl text-text tracking-tight leading-[1.05] mb-6">
            Stop juggling<br />AI apps
          </h2>
          <p className="text-muted text-lg mb-10 max-w-xl mx-auto">
            Every model, and your whole life connected. One subscription.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="/login" className="btn-ink px-7 py-3.5 text-base">
              Start free
            </a>
            <a href="/pricing" className="btn-outline px-7 py-3.5 text-base">
              See pricing
            </a>
          </div>
          <p className="text-xs text-muted mt-6">Free on the open models, no card. Upgrade any time.</p>
        </motion.div>
      </div>
    </section>
  );
}
