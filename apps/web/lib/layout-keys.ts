// Single source of truth for the per-section show/hide controls on the
// dashboard and briefing. The Display settings UI renders a toggle per entry;
// the dashboard/briefing pages gate each widget/section on its key. Keep keys
// stable — they're persisted in Firestore `settings.layout.*Hidden[]`.

export type LayoutItem = { key: string; label: string; hint?: string };

// Dashboard widgets. `focus` and `stats` are the at-a-glance essentials; the
// rest are optional surfaces users may not want.
export const DASHBOARD_WIDGETS: LayoutItem[] = [
  { key: 'focus', label: 'Focus card', hint: "Today's single most important thing" },
  { key: 'stats', label: 'Stat pills', hint: 'Goals, tasks due, top streak' },
  { key: 'quickActions', label: 'Quick actions', hint: 'Add task / goal / habit shortcuts' },
  { key: 'needsYou', label: 'Needs you', hint: 'MODUS proactive approvals feed' },
  { key: 'briefing', label: "Today's briefing", hint: 'Briefing preview widget' },
  { key: 'inbox', label: 'Inbox', hint: 'Recent Gmail threads' },
  { key: 'tasks', label: 'Tasks', hint: 'Due today' },
  { key: 'schedule', label: "Today's schedule", hint: 'Calendar events' },
];

// Briefing sections. The header + narrative always render; these are the
// optional cards below it.
export const BRIEFING_SECTIONS: LayoutItem[] = [
  { key: 'schedule', label: 'Schedule timeline' },
  { key: 'actionQueue', label: 'Needs attention', hint: 'Overdue tasks + at-risk habits' },
  { key: 'inbox', label: 'Inbox', hint: 'Unread email triage' },
  { key: 'mission', label: 'Top priority' },
  { key: 'energy', label: 'Energy check-in' },
  { key: 'top3', label: 'Top 3 (checkable)' },
  { key: 'habits', label: 'Habits status' },
  { key: 'looseEnd', label: 'Loose end' },
  { key: 'pattern', label: 'MODUS noticed', hint: 'Pattern callouts' },
  { key: 'relationship', label: 'Relationship nudge' },
  { key: 'news', label: 'In the news' },
];

export const DASHBOARD_KEYS = DASHBOARD_WIDGETS.map((w) => w.key);
export const BRIEFING_KEYS = BRIEFING_SECTIONS.map((s) => s.key);
