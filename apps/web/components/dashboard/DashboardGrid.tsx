'use client';

import { motion } from 'framer-motion';
import TaskList from './TaskList';
import GmailWidget from './GmailWidget';
import CalendarWidget from './CalendarWidget';
import Link from 'next/link';

interface WidgetProps {
  title: string;
  icon: React.ReactNode;
  href?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Widget({ title, icon, href, action, children, className = '' }: WidgetProps) {
  return (
    <motion.div
      className={`bg-panel border border-border/60 rounded-2xl flex flex-col overflow-hidden ${className}`}
      whileHover={{ y: -2, borderColor: 'rgba(124,58,237,0.20)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ willChange: 'transform' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center text-brand">
            {icon}
          </div>
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        {action ?? (href && (
          <motion.div whileHover={{ x: 2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
            <Link href={href} className="text-[11px] text-muted hover:text-brand transition-colors">
              View all →
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {children}
      </div>
    </motion.div>
  );
}

const Icons = {
  briefing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  gmail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

function FadeUp({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 190, damping: 22, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function DashboardGrid({ hidden }: { hidden?: Set<string> }) {
  const show = (key: string) => !hidden?.has(key);
  // The briefing now surfaces in the top-of-page hero (BriefingHero), not as a
  // grid widget — so the left column is just the Inbox.
  const showInbox = show('inbox');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

        {/* Left column */}
        {showInbox && (
          <div className="flex flex-col gap-4">
            <FadeUp delay={0.12}>
              <Widget title="Inbox" icon={Icons.gmail} href="/briefing" className="min-h-[220px]">
                <GmailWidget />
              </Widget>
            </FadeUp>
          </div>
        )}

        {/* Right column */}
        {show('tasks') && (
          <div className="flex flex-col gap-4">
            <FadeUp delay={0.06}>
              <Widget title="Tasks" icon={Icons.tasks} href="/tasks" className="min-h-[180px]">
                <TaskList />
              </Widget>
            </FadeUp>
          </div>
        )}
      </div>

      {/* Full-width Calendar */}
      {show('schedule') && (
        <FadeUp delay={0.18}>
          <Widget title="Today's Schedule" icon={Icons.calendar} className="min-h-[80px]">
            <CalendarWidget />
          </Widget>
        </FadeUp>
      )}
    </div>
  );
}
