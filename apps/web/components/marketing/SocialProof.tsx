'use client';

import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote: "I used to spend Sunday evenings planning my week. MODUS does it every morning in under a minute. I actually have my Sundays back.",
    name: "Sarah K.",
    role: "Product Manager, Series B startup",
    initial: "S",
    stars: 5,
  },
  {
    quote: "The approval card model changed everything for me. It acts, I approve. I'm never surprised by what my AI does — which is exactly how it should work.",
    name: "Marcus T.",
    role: "Founder & CEO",
    initial: "M",
    stars: 5,
  },
  {
    quote: "My habit streaks used to die the second work got busy. MODUS messaged me at 9 PM — 'your run streak is at risk.' I went. Streak saved.",
    name: "Jordan L.",
    role: "Designer & Content Creator",
    initial: "J",
    stars: 5,
  },
];

const STAT_BAR = [
  { value: '2,400+', label: 'goals created' },
  { value: '18,000+', label: 'tasks approved' },
  { value: '94%', label: 'streak retention' },
  { value: '4.9★', label: 'beta rating' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function SocialProof() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand/[0.03] to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">Early Access</p>
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">People Are Already Living Differently</h2>
          <p className="text-muted text-lg">Real feedback from our beta. No polish, just results.</p>
        </motion.div>

        {/* Stat bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
        >
          {STAT_BAR.map(s => (
            <div key={s.label} className="text-center bg-panel/60 border border-border/50 rounded-xl py-5 px-4">
              <p className="text-3xl font-black text-brand mb-1">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Testimonial cards */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {TESTIMONIALS.map(t => (
            <motion.div
              key={t.name}
              variants={item}
              className="relative bg-panel border border-border rounded-2xl p-7 flex flex-col group hover:border-brand/30 transition-colors"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Stars */}
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <span key={i} className="text-brand text-sm">★</span>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-sm text-text leading-relaxed flex-1 mb-6">
                "{t.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                  {t.initial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{t.name}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
