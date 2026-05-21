'use client';

import GoalCard from './GoalCard';
import HabitTracker from './HabitTracker';
import TaskList from './TaskList';
import BriefingWidget from './BriefingWidget';
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
    <div className={`bg-panel border border-border/60 rounded-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center text-brand">
            {icon}
          </div>
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        {action ?? (href && (
          <Link href={href} className="text-[11px] text-muted hover:text-brand transition-colors">
            View all →
          </Link>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {children}
      </div>
    </div>
  );
}

// Inline SVG icons for widget headers
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
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  habits: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
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

export default function DashboardGrid() {
  return (
    <div className="space-y-4">
      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

        {/* Left column: Briefing + Gmail */}
        <div className="flex flex-col gap-4">
          <Widget
            title="Today's Briefing"
            icon={Icons.briefing}
            href="/briefing"
            className="min-h-[200px]"
          >
            <BriefingWidget />
          </Widget>

          <Widget
            title="Inbox"
            icon={Icons.gmail}
            href="/briefing"
            className="min-h-[220px]"
          >
            <GmailWidget />
          </Widget>
        </div>

        {/* Right column: Goals + Tasks + Habits */}
        <div className="flex flex-col gap-4">
          <Widget
            title="Goals"
            icon={Icons.goals}
            href="/goals"
            className="min-h-[180px]"
          >
            <GoalCard />
          </Widget>

          <Widget
            title="Tasks"
            icon={Icons.tasks}
            href="/tasks"
            className="min-h-[180px]"
          >
            <TaskList />
          </Widget>

          <Widget
            title="Habits"
            icon={Icons.habits}
            href="/habits"
            className="min-h-[140px]"
          >
            <HabitTracker />
          </Widget>
        </div>
      </div>

      {/* Full-width Calendar row */}
      <Widget
        title="Today's Schedule"
        icon={Icons.calendar}
        className="min-h-[80px]"
      >
        <CalendarWidget />
      </Widget>
    </div>
  );
}
