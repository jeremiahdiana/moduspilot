'use client';

import { motion } from 'framer-motion';

export default function FinalCTA() {
  return (
    <section className="relative py-36 px-6 overflow-hidden">
      {/* Soft violet bloom behind the closing statement */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_45%,rgba(124,58,237,0.12),transparent_70%)]"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-4xl md:text-6xl text-text tracking-tight leading-[1.05] mb-6">
            Stop juggling<br />AI apps
          </h2>
          <p className="text-muted text-lg mb-10 max-w-xl mx-auto">
            Every model, your whole life connected, one subscription. Start free, no card.
          </p>
          <a
            href="/login"
            className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-white text-base font-bold rounded-xl transition-transform hover:scale-[1.02] active:scale-100"
          >
            Start free, no card
            <span>→</span>
          </a>
          <p className="text-xs text-muted/70 mt-6">10 messages on every frontier model, no card · then a 3-day trial</p>
        </motion.div>
      </div>
    </section>
  );
}
