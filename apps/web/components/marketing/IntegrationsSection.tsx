'use client';

import { motion } from 'framer-motion';

type Integration = { name: string; desc: string; surface: 'Web' | 'Mac' | 'iPhone'; svg: React.ReactNode };

const INTEGRATIONS: Integration[] = [
  {
    name: 'Gmail', desc: 'Read, draft, send', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    name: 'Google Calendar', desc: 'Schedule, block, reschedule', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" opacity="0.15"/>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
        <line x1="3" y1="9" x2="21" y2="9" stroke="#4285F4" strokeWidth="1.5"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Google Drive', desc: 'Docs for context', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M7.71 3L1 14.5l3.5 6L8.5 14 15 3z" fill="#4285F4" opacity="0.8"/>
        <path d="M16.5 3H7.71L14.21 14h8.5z" fill="#34A853" opacity="0.8"/>
        <path d="M4.5 20.5h15l3.5-6H8.5z" fill="#FBBC05" opacity="0.9"/>
      </svg>
    ),
  },
  {
    name: 'Notion', desc: 'Pages, databases, docs', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
      </svg>
    ),
  },
  {
    name: 'Slack', desc: 'Read + send messages', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
      </svg>
    ),
  },
  {
    name: 'GitHub', desc: 'PRs, issues, work', surface: 'Web',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    name: 'iMessage', desc: 'Read threads, draft replies', surface: 'Mac',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#34C759" d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.6 6.1-.2 1.2-.9 2.4-1.9 3.4 1.7-.2 3.3-.8 4.6-1.8 1.1.3 2.4.5 3.7.5 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/>
      </svg>
    ),
  },
  {
    name: 'Apple Notes', desc: 'Search & surface notes', surface: 'Mac',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#FEC934"/>
        <path stroke="#fff" strokeWidth="1.5" strokeLinecap="round" d="M8 8.5h8M8 12h8M8 15.5h5"/>
      </svg>
    ),
  },
  {
    name: 'Reminders', desc: 'Sync tasks & reminders', surface: 'Mac',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <circle cx="6" cy="7.5" r="2" fill="#FF3B30"/>
        <circle cx="6" cy="15" r="2" fill="#FF9500"/>
        <path stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" d="M11 7.5h9M11 15h9"/>
      </svg>
    ),
  },
  {
    name: 'Contacts', desc: 'Relationship context', surface: 'iPhone',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#8E8E93" opacity="0.15" stroke="#8E8E93" strokeWidth="1.3"/>
        <circle cx="12" cy="10" r="2.6" fill="#8E8E93"/>
        <path d="M7.5 17.5c.6-2 2.3-3 4.5-3s3.9 1 4.5 3" fill="#8E8E93"/>
      </svg>
    ),
  },
  {
    name: 'Photos', desc: 'Pull in your images', surface: 'iPhone',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#8E8E93" strokeWidth="1.3"/>
        <circle cx="8" cy="10" r="1.6" fill="#FFCC00"/>
        <path d="M4 18l4.5-4.5 3 3L16 12l4 4" stroke="#34C759" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Apple Health', desc: 'Steps & sleep in your briefing', surface: 'iPhone',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#FF2D55" d="M12 21s-6.8-4.35-9-8.5C1.3 9.3 2.6 6 5.7 6c1.9 0 3 1.1 3.8 2.3l.6.9.6-.9C11.5 7.1 12.6 6 14.5 6c3.1 0 4.4 3.3 2.7 6.5-2.2 4.15-9 8.5-9 8.5z"/>
      </svg>
    ),
  },
  {
    name: 'iCloud Drive', desc: 'Open any file for context', surface: 'iPhone',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#3B9EDB" d="M7 18.5a4.2 4.2 0 0 1-.5-8.37 5.2 5.2 0 0 1 10-1.45A3.75 3.75 0 0 1 18.2 18.5H7z"/>
      </svg>
    ),
  },
  {
    name: 'Obsidian', desc: 'Chat with your markdown vault', surface: 'iPhone',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#8B5CF6" d="M13.2 2 5.5 8.8 8 20l7.2 2 3.8-8.2L16.5 5z"/>
        <path fill="#a78bfa" d="M13.2 2 8 8.8l4 5.2 3.5-3.2z"/>
      </svg>
    ),
  },
];

const SURFACE_STYLE: Record<Integration['surface'], string> = {
  Web:    'bg-emerald-500/10 text-emerald-400',
  Mac:    'bg-blue-500/10 text-blue-400',
  iPhone: 'bg-brand/10 text-brand',
};

export default function IntegrationsSection() {
  return (
    <section className="py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">Integrations</p>
          <h2 className="text-4xl md:text-5xl font-black text-text leading-tight mb-4">
            Your tools. All connected. Actually live.
          </h2>
          <p className="text-muted text-base leading-relaxed max-w-2xl mx-auto mb-4">
            Not &ldquo;coming soon.&rdquo; MODUS reads your Gmail, writes to your calendar, pulls Notion and Drive, watches GitHub — and on your Mac and iPhone, it reaches your iMessage, notes, reminders, photos, health, and even your Obsidian vault.
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-muted">Live across web, Mac &amp; iPhone</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {INTEGRATIONS.map((int, i) => (
            <motion.div
              key={int.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: (i % 4) * 0.05, ease: 'easeOut' }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className="bg-panel border border-border rounded-xl p-4 hover:border-brand/25 hover:shadow-md hover:shadow-brand/5 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="shrink-0">{int.svg}</div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${SURFACE_STYLE[int.surface]}`}>{int.surface}</span>
              </div>
              <p className="text-sm font-semibold text-text">{int.name}</p>
              <p className="text-xs text-muted mt-0.5 leading-snug">{int.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
