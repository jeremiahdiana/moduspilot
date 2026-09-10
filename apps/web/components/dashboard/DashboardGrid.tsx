'use client';

import { motion, Reorder, useDragControls } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  /** Drag handle wiring — supplied when the widget lives in the reorderable list. */
  dragControls?: ReturnType<typeof useDragControls>;
}

function DragHandle({ controls }: { controls: ReturnType<typeof useDragControls> }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
      className="cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted transition-colors touch-none -ml-1 mr-0.5"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

function Widget({ title, icon, href, action, children, className = '', dragControls }: WidgetProps) {
  return (
    <motion.div
      className={`bg-panel border border-border/60 rounded-2xl flex flex-col overflow-hidden ${className}`}
      whileHover={{ borderColor: 'rgba(124,58,237,0.20)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ willChange: 'transform' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2.5">
          {dragControls && <DragHandle controls={dragControls} />}
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

// The widgets this grid owns, in their default order. The briefing, focus and
// needsYou cards are rendered by the dashboard page itself (above the grid), so
// they are not reorderable here.
const WIDGET_DEFS: Record<string, { title: string; icon: React.ReactNode; href?: string; minH: string; render: () => React.ReactNode }> = {
  inbox:    { title: 'Inbox',            icon: Icons.gmail,    href: '/briefing', minH: 'min-h-[220px]', render: () => <GmailWidget /> },
  tasks:    { title: 'Tasks',            icon: Icons.tasks,    href: '/tasks',    minH: 'min-h-[180px]', render: () => <TaskList /> },
  schedule: { title: "Today's Schedule", icon: Icons.calendar,                    minH: 'min-h-[80px]',  render: () => <CalendarWidget /> },
};
const DEFAULT_ORDER = ['inbox', 'tasks', 'schedule'];

// Merge the saved order with the canonical list: keep known saved keys in their
// saved order, then append any widgets the user has never reordered (e.g. new
// ones shipped later), so the list is always complete and never loses a widget.
function resolveOrder(saved: string[]): string[] {
  const known = saved.filter(k => k in WIDGET_DEFS);
  const missing = DEFAULT_ORDER.filter(k => !known.includes(k));
  return [...known, ...missing];
}

// A single reorderable widget row. Its own drag controls mean only the handle
// starts a drag — the scrollable widget body stays clickable/scrollable.
function ReorderableWidget({ id }: { id: string }) {
  const controls = useDragControls();
  const def = WIDGET_DEFS[id];
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ scale: 1.01, boxShadow: '0 12px 30px rgba(0,0,0,0.18)', zIndex: 20 }}
    >
      <Widget title={def.title} icon={def.icon} href={def.href} className={def.minH} dragControls={controls}>
        {def.render()}
      </Widget>
    </Reorder.Item>
  );
}

export default function DashboardGrid({ uid, hidden, order }: { uid?: string; hidden?: Set<string>; order?: string[] }) {
  const visible = resolveOrder(order ?? []).filter(k => !hidden?.has(k));

  const persist = (next: string[]) => {
    if (!uid) return;
    // Recursive merge leaves dashboardHidden/briefingHidden intact.
    void setDoc(doc(db, 'users', uid), { settings: { layout: { dashboardOrder: next } } }, { merge: true });
  };

  return (
    <Reorder.Group
      axis="y"
      values={visible}
      onReorder={persist}
      className="flex flex-col gap-4"
    >
      {visible.map(id => (
        <ReorderableWidget key={id} id={id} />
      ))}
    </Reorder.Group>
  );
}
