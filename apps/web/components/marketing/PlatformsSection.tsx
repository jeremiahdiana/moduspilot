'use client';

import { motion } from 'framer-motion';

const PLATFORMS = [
  {
    icon: '◉',
    title: 'iOS App',
    badge: 'Primary',
    desc: 'Push notifications, HealthKit, native integrations, voice interface. MODUS reaches you — you don\'t open it to check.',
    detail: 'Expo React Native · Firebase · RevenueCat',
  },
  {
    icon: '◈',
    title: 'Web App',
    badge: null,
    desc: 'Full dashboard + AI chat at app.moduspilot.com. Accessible anywhere, fully synced.',
    detail: 'Next.js · Vercel · Real-time sync',
  },
  {
    icon: '◎',
    title: 'Mac App',
    badge: 'Coming Soon',
    desc: 'Menu bar access, keyboard shortcuts. Always one keystroke away.',
    detail: '⌘K command bar · Native notifications',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function PlatformsSection() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">Everywhere You Work</h2>
          <p className="text-muted text-lg">One OS. Every surface.</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {PLATFORMS.map(p => (
            <motion.div
              key={p.title}
              variants={item}
              className="bg-panel border border-border rounded-2xl p-8 hover:border-brand/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="text-3xl text-brand/60 group-hover:text-brand transition-colors mb-6">{p.icon}</div>

              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-bold text-text">{p.title}</h3>
                {p.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.badge === 'Primary' ? 'bg-brand/20 text-brand' : 'bg-border text-muted'
                  }`}>
                    {p.badge}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted leading-relaxed mb-4">{p.desc}</p>
              <p className="text-xs text-muted/50">{p.detail}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
