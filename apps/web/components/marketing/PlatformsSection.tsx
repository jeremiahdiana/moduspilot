'use client';

import { motion } from 'framer-motion';

const PLATFORMS = [
  {
    icon: '◈',
    title: 'Web App',
    badge: 'Live Now',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    desc: 'Full dashboard, AI chat, goals, habits, tasks, and briefings at app.moduspilot.com. No install. Works everywhere.',
    detail: 'Next.js · Vercel · Real-time sync',
  },
  {
    icon: '◉',
    title: 'iOS App',
    badge: 'Coming Soon',
    badgeColor: 'bg-border text-muted',
    desc: 'Push notifications, HealthKit, voice interface. MODUS reaches you — you don\'t open it to check.',
    detail: 'Expo React Native · Firebase · RevenueCat',
  },
  {
    icon: '◎',
    title: 'Telegram',
    badge: 'Coming Soon',
    badgeColor: 'bg-border text-muted',
    desc: 'Chat with MODUS directly from Telegram. Same memory, same approvals, no app switch required.',
    detail: 'Telegram Bot API · Webhook sync',
  },
  {
    icon: '▣',
    title: 'Mac App',
    badge: 'Coming Soon',
    badgeColor: 'bg-border text-muted',
    desc: 'Menu bar access, ⌘K command bar. Always one keystroke away from your operating system.',
    detail: 'Native notifications · Global shortcut',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function PlatformsSection() {
  return (
    <section className="py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">Everywhere You Work</h2>
          <p className="text-muted text-lg">One OS. Every surface. Start on web today.</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {PLATFORMS.map(p => (
            <motion.div
              key={p.title}
              variants={item}
              className="bg-panel border border-border rounded-2xl p-6 hover:border-brand/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-3xl text-brand/60 group-hover:text-brand transition-colors mb-4">{p.icon}</div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="text-base font-bold text-text">{p.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-3">{p.desc}</p>
              <p className="text-xs text-muted/40">{p.detail}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
