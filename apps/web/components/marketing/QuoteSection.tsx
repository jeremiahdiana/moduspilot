'use client';

import { motion } from 'framer-motion';

export default function QuoteSection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-panel" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="text-brand text-5xl font-serif mb-8 opacity-40">"</div>
          <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold text-text leading-tight mb-8">
            While every other tool forces you to manually manage your software,
            MODUS is the first software that actively manages your reality.
          </blockquote>
          <p className="text-muted text-sm tracking-wider uppercase">— MODUS Pilot, Product Vision</p>
        </motion.div>
      </div>
    </section>
  );
}
