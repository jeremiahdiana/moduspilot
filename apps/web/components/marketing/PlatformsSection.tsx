'use client';

import { motion } from 'framer-motion';
import { AppleLogo, WebGlobe, WindowsLogo } from './BrandLogos';

const PLATFORMS = [
  {
    icon: <WebGlobe className="w-8 h-8" />,
    title: 'Web App',
    badge: 'Live',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    desc: 'The full MODUS: dashboard, AI chat, goals, habits, tasks, and briefings at app.moduspilot.com. No install. Works everywhere.',
    detail: 'Same account, real-time sync',
    cta: 'Open the web app →',
    href: 'https://app.moduspilot.com',
  },
  {
    icon: <AppleLogo className="w-8 h-8" />,
    title: 'Mac App',
    badge: 'Live',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    desc: 'A native desktop app with your notes, iMessage, reminders, and calendar synced in, plus native notifications on your Mac.',
    detail: 'Signed & auto-updating · Intel & Apple Silicon',
    cta: 'Download for Mac →',
    href: '/download/mac',
  },
  {
    icon: <WindowsLogo className="w-8 h-8" />,
    title: 'Windows App',
    badge: 'Beta',
    badgeColor: 'bg-brand/15 text-brand',
    desc: 'The native MODUS desktop on Windows: your chat, notifications, and a system-tray presence, kept in sync with every other surface.',
    detail: 'Windows 10 & 11 · 64-bit',
    cta: 'Download for Windows →',
    href: '/download/windows',
  },
  {
    icon: <AppleLogo className="w-8 h-8" />,
    title: 'iPhone App',
    badge: 'Beta',
    badgeColor: 'bg-brand/15 text-brand',
    desc: 'MODUS in your pocket: chat, model switcher, image & document creation, and push notifications so it reaches you. Rolling out now.',
    detail: 'TestFlight beta',
    cta: null,
    href: null,
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
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text mb-4">Everywhere you work</h2>
          <p className="text-muted text-lg">Live on web, Mac &amp; Windows. iPhone app in beta.</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
        >
          {PLATFORMS.map(p => (
            <motion.div
              key={p.title}
              variants={item}
              className="bg-panel rounded-2xl p-6 transition-shadow hover:shadow-lg hover:shadow-black/30 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-3xl text-brand/60 group-hover:text-brand transition-colors mb-4">{p.icon}</div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="text-base font-bold text-text">{p.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-3">{p.desc}</p>
              <p className="text-xs text-muted/40">{p.detail}</p>
              {p.href && p.cta && (
                <a
                  href={p.href}
                  {...(p.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex items-center mt-4 text-sm font-semibold text-brand hover:underline"
                >
                  {p.cta}
                </a>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
