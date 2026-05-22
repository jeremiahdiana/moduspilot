'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  Timestamp, doc, updateDoc,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import type { BriefingData, BriefingScheduleItem } from '@/lib/briefing';
import type { GmailThread } from '@/lib/google-gmail';
import type { CalendarEvent } from '@/lib/google-calendar';
import MessageBubble from '@/components/chat/MessageBubble';

interface Briefing {
  id: string;
  title: string;
  content: string;
  briefingData: BriefingData | null;
  createdAt: Date;
  read: boolean;
  energy: string | null;
  completedTop3: number[];
}

function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function fmtHeader(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtShort(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate()-1);
  if (d >= today) return 'Today';
  if (d >= yest) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconBolt = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconChecks = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l4 4L20 4"/><path d="M4 18l4 4 12-12" opacity="0.4"/>
  </svg>
);
const IconTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconFlame = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);
const IconNewspaper = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
  </svg>
);

// ── Shared ────────────────────────────────────────────────────────────────────

function BCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-panel border border-border rounded-xl px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function Label({ icon, color, text, right }: {
  icon: React.ReactNode; color: string; text: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{text}</span>
      </div>
      {right}
    </div>
  );
}

// ── Energy check ──────────────────────────────────────────────────────────────

const ENERGY_OPTS = [
  { key: 'fully_charged', label: 'Fully charged', emoji: '🔋' },
  { key: 'okay',          label: 'Okay',           emoji: '😐' },
  { key: 'running_low',   label: 'Running low',    emoji: '😴' },
];
const ENERGY_CONFIRM: Record<string, string> = {
  fully_charged: 'front-load your hardest work.',
  okay:          'pace your day around your top 3.',
  running_low:   'protect your focus — only essentials today.',
};
const ENERGY_CHAT: Record<string, string> = {
  fully_charged: "Fully charged today — let's make the most of it.",
  okay:          'Feeling okay today — help me pace this well.',
  running_low:   'Running low on energy today — help me protect my focus.',
};

function EnergyCard({ energy, onSelect }: { energy: string | null; onSelect: (k: string, chatMsg: string) => void }) {
  const [custom, setCustom] = useState('');
  if (energy) {
    const opt = ENERGY_OPTS.find(o => o.key === energy);
    return (
      <BCard>
        <Label icon={<IconBolt />} color="text-amber-500" text="Energy check" />
        <p className="text-sm font-medium text-text mb-1">{opt ? `${opt.emoji} ${opt.label}` : energy}</p>
        <p className="text-xs text-muted">Modus will {ENERGY_CONFIRM[energy] ?? 'keep this in mind.'}</p>
      </BCard>
    );
  }
  return (
    <BCard>
      <Label icon={<IconBolt />} color="text-amber-500" text="Energy check" />
      <p className="text-sm text-muted mb-3">Where are you at this morning?</p>
      <div className="flex gap-1.5 flex-wrap">
        {ENERGY_OPTS.map(o => (
          <button key={o.key} onClick={() => onSelect(o.key, ENERGY_CHAT[o.key])}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-bg text-text hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors cursor-pointer">
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
      <input value={custom} onChange={e => setCustom(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onSelect(custom.trim(), custom.trim()); setCustom(''); } }}
        placeholder="Or type how you're feeling..."
        className="mt-3 w-full bg-transparent text-xs text-muted placeholder:text-muted/40 outline-none border-none" />
    </BCard>
  );
}

// ── Email inbox ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-orange-500','bg-pink-500'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function ContactAvatar({ name }: { name: string }) {
  return (
    <span className={`w-7 h-7 rounded-full ${avatarColor(name)} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function ApprovalQueueCard({ threads, connected, filter, onFilterChange, onConnectGoogle, onDraftReply }: {
  threads: GmailThread[]; connected: boolean; filter: 'primary' | 'all';
  onFilterChange: (f: 'primary' | 'all') => void;
  onConnectGoogle: () => void; onDraftReply: (t: GmailThread) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;
  const shown = showAll ? threads : threads.slice(0, LIMIT);

  const FilterToggle = () => (
    <div className="flex items-center bg-bg border border-border rounded-lg p-0.5 gap-0.5">
      {(['primary', 'all'] as const).map(f => (
        <button key={f} onClick={() => onFilterChange(f)}
          className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${filter === f ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}>
          {f === 'primary' ? 'Primary' : 'All'}
        </button>
      ))}
    </div>
  );

  if (!connected) {
    return (
      <BCard>
        <div className="flex items-center justify-between mb-3">
          <Label icon={<IconChecks />} color="text-emerald-500" text="Inbox" />
          <FilterToggle />
        </div>
        <p className="text-xs text-muted mb-3">Connect Gmail to surface emails that need your attention.</p>
        <button onClick={onConnectGoogle} className="text-xs px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 transition-colors cursor-pointer">Connect Google →</button>
      </BCard>
    );
  }

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500"><IconChecks /></span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Inbox</span>
          {threads.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{threads.length} unread</span>
          )}
        </div>
        <FilterToggle />
      </div>
      {threads.length === 0 ? (
        <div className="px-5 py-4 space-y-1">
          <p className="text-xs text-muted">{filter === 'primary' ? 'No unread primary emails in 48h.' : 'No unread emails in 48h.'}</p>
          {filter === 'primary' && <button onClick={() => onFilterChange('all')} className="text-[11px] text-brand hover:underline cursor-pointer">Show all categories →</button>}
        </div>
      ) : (
        <>
          {shown.map(t => (
            <div key={t.id} className="border-b border-border/50 last:border-b-0">
              <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-brand/5 transition-colors text-left cursor-pointer">
                <ContactAvatar name={t.from || t.fromAddress} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-text truncate">{t.from}</span>
                    <span className="text-[10px] text-muted shrink-0">{t.date?.slice(0, 6)}</span>
                  </div>
                  <p className="text-[12px] text-text/90 truncate">{t.subject}</p>
                  {expanded !== t.id && <p className="text-[11px] text-muted truncate mt-0.5">{t.snippet}</p>}
                </div>
                {t.unread && <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0 mt-1.5" />}
              </button>
              {expanded === t.id && (
                <div className="px-5 pb-4">
                  <div className="bg-bg rounded-lg p-3 mt-0.5">
                    <p className="text-[12px] text-text/80 leading-relaxed whitespace-pre-wrap">
                      {(t.body || t.snippet || 'No content available.').slice(0, 600)}
                      {(t.body || t.snippet || '').length > 600 && '…'}
                    </p>
                  </div>
                  <button onClick={() => onDraftReply(t)} className="mt-2.5 text-[11px] px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                    Draft reply with MODUS ↗
                  </button>
                </div>
              )}
            </div>
          ))}
          {threads.length > LIMIT && (
            <button onClick={() => setShowAll(v => !v)} className="w-full py-2.5 text-xs text-muted hover:text-text text-center transition-colors cursor-pointer">
              {showAll ? 'Show less' : `+ ${threads.length - LIMIT} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Schedule timeline ─────────────────────────────────────────────────────────

const EVENT_COLORS = ['bg-brand', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
const START_HOUR = 8;
const END_HOUR = 20;
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;
const HOUR_MARKERS = [8, 10, 12, 14, 16, 18, 20];

function toMins(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
function toPercent(mins: number) {
  return ((Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, mins)) - START_HOUR * 60) / TOTAL_MINS) * 100;
}

function ScheduleTimeline({ events, schedule, connected, onConnectGoogle }: {
  events: CalendarEvent[]; schedule: BriefingScheduleItem[];
  connected: boolean; onConnectGoogle: () => void;
}) {
  if (!connected) {
    return (
      <BCard>
        <Label icon={<IconCalendar />} color="text-blue-500" text="Today's schedule" />
        <p className="text-xs text-muted mb-3">Connect Google Calendar to see your meetings here.</p>
        <button onClick={onConnectGoogle} className="text-xs px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 transition-colors cursor-pointer">Connect Google →</button>
      </BCard>
    );
  }

  const dayEvents = events.filter(e => !e.allDay && e.start);

  if (dayEvents.length === 0 && schedule.length === 0) {
    return (
      <BCard>
        <Label icon={<IconCalendar />} color="text-blue-500" text="Today's schedule" />
        <p className="text-xs text-muted">No meetings today — clear runway.</p>
      </BCard>
    );
  }

  return (
    <BCard>
      <Label icon={<IconCalendar />} color="text-blue-500" text="Today's schedule" />
      {dayEvents.length > 0 ? (
        <div className="mt-2">
          {/* Hour markers */}
          <div className="flex justify-between mb-1">
            {HOUR_MARKERS.map(h => (
              <span key={h} className="text-[9px] text-muted leading-none">
                {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
              </span>
            ))}
          </div>
          {/* Track */}
          <div className="relative h-9 bg-bg rounded-lg overflow-hidden border border-border/40">
            {HOUR_MARKERS.map(h => (
              <div key={h} className="absolute top-0 bottom-0 w-px bg-border/50" style={{ left: `${toPercent(h * 60)}%` }} />
            ))}
            {dayEvents.map((e, i) => {
              const startMins = toMins(e.start);
              const endMins = e.end ? toMins(e.end) : startMins + 60;
              const left = toPercent(startMins);
              const width = Math.max(toPercent(endMins) - left, 2.5);
              return (
                <div key={i}
                  className={`absolute top-1 bottom-1 rounded ${EVENT_COLORS[i % EVENT_COLORS.length]} flex items-center px-1.5 overflow-hidden opacity-85`}
                  style={{ left: `${left}%`, width: `${width}%` }} title={e.title}>
                  <span className="text-[9px] font-semibold text-white truncate">{e.title}</span>
                </div>
              );
            })}
          </div>
          {/* List */}
          <div className="mt-3 space-y-1.5">
            {dayEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-sm shrink-0 ${EVENT_COLORS[i % EVENT_COLORS.length]}`} />
                <span className="text-[11px] text-muted w-14 shrink-0">
                  {new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
                <span className="text-xs text-text truncate">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 mt-2">
          {schedule.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-bg rounded-lg">
              <span className="text-[11px] font-medium text-muted w-16 shrink-0">{item.time}</span>
              <span className="text-[13px] text-text flex-1 truncate">{item.title}</span>
            </div>
          ))}
        </div>
      )}
    </BCard>
  );
}

// ── Checkable Top 3 ───────────────────────────────────────────────────────────

function CheckableTop3Card({ items, completedIndices, onToggle }: {
  items: { task: string; source: string }[];
  completedIndices: number[];
  onToggle: (i: number) => void;
}) {
  return (
    <BCard>
      <Label icon={<IconTarget />} color="text-blue-500" text="Top 3 today" />
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const done = completedIndices.includes(i);
          return (
            <button key={i} onClick={() => onToggle(i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg hover:bg-brand/5 transition-colors text-left group cursor-pointer">
              <span className={`text-[11px] font-bold w-3 shrink-0 ${done ? 'text-muted/40' : 'text-brand/40'}`}>{i + 1}</span>
              <motion.div whileTap={{ scale: 0.8 }}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-brand border-brand' : 'border-border group-hover:border-brand/50'}`}>
                {done && <span className="text-white text-[8px] leading-none">✓</span>}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium transition-colors ${done ? 'text-muted line-through' : 'text-text'}`}>{item.task}</p>
                {item.source && <p className="text-[10px] text-muted mt-0.5">{item.source}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </BCard>
  );
}

// ── Interactive habits card ───────────────────────────────────────────────────

function InlineBriefingHabits({ habits, onToggle }: {
  habits: { id: string; title: string; streak: number; done: boolean; completedDates: string[] }[];
  onToggle: (h: { id: string; completedDates: string[] }) => void;
}) {
  if (habits.length === 0) return null;
  const doneCount = habits.filter(h => h.done).length;
  const allDone = doneCount === habits.length;

  return (
    <BCard>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-orange-500"><IconFlame /></span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Habits</span>
        </div>
        <span className={`text-[11px] font-medium ${allDone ? 'text-emerald-400' : 'text-muted'}`}>{doneCount}/{habits.length}</span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden mb-3">
        <motion.div className="h-full bg-brand rounded-full"
          animate={{ width: `${habits.length > 0 ? (doneCount / habits.length) * 100 : 0}%` }}
          transition={{ duration: 0.5 }} />
      </div>
      <div className="space-y-1">
        {habits.map(h => (
          <button key={h.id} onClick={() => onToggle(h)}
            className="w-full flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-bg transition-colors text-left group cursor-pointer">
            <motion.div whileTap={{ scale: 0.8 }}
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${h.done ? 'bg-brand border-brand' : 'border-border group-hover:border-brand/50'}`}>
              {h.done && <span className="text-white text-[8px] leading-none">✓</span>}
            </motion.div>
            <span className={`text-xs flex-1 truncate transition-colors ${h.done ? 'text-muted line-through' : 'text-text'}`}>{h.title}</span>
            {h.streak > 1 && <span className="text-[10px] text-muted shrink-0">{h.streak}🔥</span>}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {allDone && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
            <p className="text-xs font-semibold text-emerald-400">🎉 All habits done!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </BCard>
  );
}

// ── Loose end ─────────────────────────────────────────────────────────────────

function LooseEndCard({ text, onHandle }: { text: string; onHandle?: () => void }) {
  return (
    <BCard className="flex flex-col">
      <Label icon={<IconClock />} color="text-orange-500" text="Loose end" />
      <p className="text-[13px] text-text flex-1">{text}</p>
      <button onClick={onHandle} className="mt-3 self-start text-[11px] px-2.5 py-1 rounded-lg border border-border bg-bg text-muted hover:text-text hover:border-border/80 transition-colors cursor-pointer">
        Handle now ↗
      </button>
    </BCard>
  );
}

// ── Pattern callout ───────────────────────────────────────────────────────────

function PatternCard({ text }: { text: string }) {
  return (
    <div className="bg-panel border border-border rounded-xl px-5 py-4" style={{ borderLeft: '3px solid rgba(245,158,11,0.45)' }}>
      <Label icon={
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      } color="text-amber-500" text="Modus noticed" />
      <p className="text-[13px] text-text">{text}</p>
    </div>
  );
}

// ── Mission card ──────────────────────────────────────────────────────────────

function MissionCard({ task, source }: { task: string; source?: string }) {
  return (
    <div className="rounded-xl border border-brand/20 px-5 py-4"
      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.03) 100%)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-brand"><IconTarget /></span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-brand/70">Mission today</span>
      </div>
      <p className="text-[15px] font-semibold text-text leading-snug">{task}</p>
      {source && <p className="text-[11px] text-muted mt-1">{source}</p>}
    </div>
  );
}

// ── Chat bar ──────────────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  { label: '+ Add a task',               fill: 'Add task: ' },
  { label: '↻ Check anything I missed?', fill: 'Is there anything important I missed in my briefing?' },
  { label: '📅 Show full schedule',      fill: 'Show me my schedule for today.' },
  { label: "Something's on my mind",     fill: '' },
];

function ClosingChatBar({ input, onChange, onSubmit, onChip, isLoading }: {
  input: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void; onChip: (fill: string) => void; isLoading: boolean;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[14px] font-medium text-text mb-0.5">That&apos;s your morning. Anything on your mind?</p>
        <p className="text-[12px] text-muted">Add a task, share what&apos;s weighing on you, or ask me to check something.</p>
      </div>
      <div className="px-3 py-3 grid grid-cols-2 gap-2 border-b border-border">
        {QUICK_CHIPS.map(chip => (
          <button key={chip.label} onClick={() => onChip(chip.fill)}
            className="text-[13px] font-medium px-4 py-3 rounded-xl border border-border bg-bg text-text hover:border-brand/40 hover:bg-brand/5 transition-colors cursor-pointer text-left leading-snug">
            {chip.label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 px-3 py-2.5">
        <input value={input} onChange={onChange} placeholder="Type anything or just say what's on your mind..."
          className="flex-1 bg-transparent text-[13px] text-text placeholder:text-muted/50 outline-none border-none" />
        <button type="submit" disabled={!input.trim() || isLoading}
          className="w-8 h-8 rounded-full bg-text flex items-center justify-center text-panel shrink-0 disabled:opacity-30 transition-opacity cursor-pointer">
          <IconArrowUp />
        </button>
      </form>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as const;

function FadeCard({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease }}>
      {children}
    </motion.div>
  );
}

const WMO: Record<number, string> = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Foggy',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorm',
};

function useWeather() {
  const [weather, setWeather] = useState<{ temp: number; unit: string; desc: string } | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`)
        .then(r => r.json()).then(d => {
          const cw = d.current_weather;
          if (!cw) return;
          setWeather({ temp: Math.round(cw.temperature), unit: '°F', desc: WMO[cw.weathercode] ?? 'Clear' });
        }).catch(() => {});
    }, () => {});
  }, []);
  return weather;
}

interface YesterdayStats { tasksDone: number; habitsDone: number; habitsTotal: number }

function useYesterdayStats(uid: string | null): YesterdayStats | null {
  const [stats, setStats] = useState<YesterdayStats | null>(null);
  useEffect(() => {
    if (!uid) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    const yStart = new Date(yStr + 'T00:00:00');
    const yEnd   = new Date(yStr + 'T23:59:59');
    let tasksDone = 0, habitsDone = 0, habitsTotal = 0;
    const u1 = onSnapshot(query(collection(db, 'users', uid, 'tasks'), where('done', '==', true)), snap => {
      tasksDone = snap.docs.filter(d => { const ca = d.data().completedAt?.toDate?.(); return ca && ca >= yStart && ca <= yEnd; }).length;
      setStats(s => ({ tasksDone, habitsDone: s?.habitsDone ?? 0, habitsTotal: s?.habitsTotal ?? 0 }));
    }, () => {});
    const u2 = onSnapshot(query(collection(db, 'users', uid, 'habits'), orderBy('createdAt', 'desc')), snap => {
      habitsTotal = snap.size;
      habitsDone = snap.docs.filter(d => (d.data().completedDates ?? []).includes(yStr)).length;
      setStats(s => ({ tasksDone: s?.tasksDone ?? 0, habitsDone, habitsTotal }));
    }, () => {});
    return () => { u1(); u2(); };
  }, [uid]);
  return stats;
}

function DayScoreRing({ score }: { score: number }) {
  const size = 44, r = (size - 5) / 2, circ = 2 * Math.PI * r;
  const pct = Math.min(100, score);
  const color = pct >= 80 ? '#10B981' : pct >= 40 ? '#7C3AED' : '#F59E0B';
  return (
    <div className="relative shrink-0" title={`Day readiness: ${pct}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-border" />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold leading-none" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

function useSpeech(text: string) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  function toggle() {
    if (!window.speechSynthesis) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  }
  return { speaking, toggle };
}

function briefingToSpeech(data: BriefingData | null, content: string): string {
  if (!data) return content;
  const parts: string[] = [];
  if (data.narrative) parts.push(data.narrative);
  else if (data.openingLine) parts.push(data.openingLine);
  if (data.top3.length) parts.push('Your top 3 today: ' + data.top3.map((t, i) => `${i + 1}. ${t.task}`).join('. '));
  if (data.schedule.length) parts.push('Schedule: ' + data.schedule.map(s => `${s.time} — ${s.title}`).join('. '));
  if (data.looseEnd) parts.push('Loose end: ' + data.looseEnd.text);
  if (data.patternCallout) parts.push('MODUS noticed: ' + data.patternCallout);
  return parts.join('. ');
}

function weatherEmoji(desc: string) {
  if (desc.includes('Clear')) return '☀️';
  if (desc.includes('cloud') || desc.includes('Overcast')) return '⛅';
  if (desc.includes('rain') || desc.includes('Rain') || desc.includes('shower')) return '🌧️';
  if (desc.includes('snow') || desc.includes('Snow')) return '❄️';
  if (desc.includes('Thunder')) return '⛈️';
  if (desc.includes('Fog')) return '🌫️';
  return '🌤️';
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ items, industry }: { items: { title: string; url: string; snippet: string }[]; industry: string }) {
  if (items.length === 0) return null;
  return (
    <BCard>
      <Label icon={<IconNewspaper />} color="text-blue-400" text={`In the news · ${industry}`} />
      <div className="divide-y divide-border/50">
        {items.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
            className="block py-2.5 first:pt-0 last:pb-0 group">
            <p className="text-[13px] font-medium text-text group-hover:text-brand transition-colors leading-snug">{item.title}</p>
            {item.snippet && <p className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-relaxed">{item.snippet}</p>}
          </a>
        ))}
      </div>
    </BCard>
  );
}

// ── Main BriefingPage ─────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings(user);
  const { saveMessages } = useConversations(user?.uid ?? null);

  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selected, setSelected] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'users', user.uid, 'conversations'), where('briefing', '==', true), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        title: d.data().title ?? 'Morning Briefing',
        content: d.data().messages?.[0]?.content ?? '',
        briefingData: d.data().briefingData ?? null,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        read: d.data().read ?? false,
        energy: d.data().energy ?? null,
        completedTop3: d.data().completedTop3 ?? [],
      }));
      setBriefings(list);
      setSelected(prev => {
        if (prev) { const updated = list.find(b => b.id === prev.id); return updated ?? prev; }
        const today = list.find(b => b.createdAt >= todayStart());
        return today ?? list[0] ?? null;
      });
      setLoading(false);
    }, () => { setLoading(false); });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!selected || !user || selected.read) return;
    updateDoc(doc(db, 'users', user.uid, 'conversations', selected.id), { read: true }).catch(() => {});
  }, [selected?.id, user]);

  useEffect(() => {
    if (loading || autoTriggeredRef.current || !user) return;
    const hasTodayBriefing = briefings.some(b => b.createdAt >= todayStart());
    if (!hasTodayBriefing) {
      autoTriggeredRef.current = true;
      setAutoGenerating(true);
      auth.currentUser?.getIdToken().then(token => {
        fetch('/api/briefing/generate', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .catch(() => {}).finally(() => setAutoGenerating(false));
      });
    }
  }, [loading, briefings, user]);

  const handleEnergySelect = useCallback(async (key: string) => {
    if (!selected || !user) return;
    await updateDoc(doc(db, 'users', user.uid, 'conversations', selected.id), { energy: key });
  }, [selected, user]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (briefings.length === 0 && !autoGenerating) return <EmptyBriefing />;
  if (briefings.length === 0 && autoGenerating) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted">Generating your briefing...</p>
    </div>
  );

  // Dedupe sidebar: one entry per calendar day
  const sidebarBriefings = briefings.reduce((acc: Briefing[], b) => {
    const dayKey = b.createdAt.toISOString().slice(0, 10);
    if (!acc.some(x => x.createdAt.toISOString().slice(0, 10) === dayKey)) acc.push(b);
    return acc;
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-48 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Briefings</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sidebarBriefings.map(b => (
            <button key={b.id} onClick={() => setSelected(b)}
              className={`w-full text-left px-4 py-3 transition-colors ${selected?.id === b.id ? 'bg-brand/10 border-r-2 border-brand' : 'hover:bg-panel'}`}>
              <div className="flex items-center gap-2">
                {!b.read && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                <p className={`text-xs font-medium truncate ${selected?.id === b.id ? 'text-brand' : 'text-text'}`}>{fmtShort(b.createdAt)}</p>
              </div>
              <p className="text-[11px] text-muted mt-0.5 truncate">{b.briefingData?.openingLine ?? b.content.slice(0, 50)}</p>
            </button>
          ))}
        </div>
      </aside>

      {selected && (
        <BriefingContent key={selected.id} briefing={selected}
          onEnergySelect={handleEnergySelect} settings={settings}
          saveMessages={saveMessages} autoGenerating={autoGenerating} />
      )}
    </div>
  );
}

// ── BriefingContent ───────────────────────────────────────────────────────────

function BriefingContent({ briefing, onEnergySelect, settings, saveMessages, autoGenerating }: {
  briefing: Briefing;
  onEnergySelect: (key: string) => void;
  settings: ReturnType<typeof useUserSettings>['settings'];
  saveMessages: (id: string, msgs: Message[], title?: string) => Promise<void>;
  autoGenerating?: boolean;
}) {
  const { user } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const savedLengthRef = useRef(1);
  const prevLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Integration data
  const [gmailThreads, setGmailThreads] = useState<GmailThread[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [emailFilter, setEmailFilter] = useState<'primary' | 'all'>('primary');

  // Live Firestore: habits + due task count
  const [habits, setHabits] = useState<{ id: string; title: string; streak: number; done: boolean; completedDates: string[] }[]>([]);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [newsItems, setNewsItems] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [newsIndustry, setNewsIndustry] = useState('');

  // Top 3 completion (Firestore-backed)
  const [completedTop3, setCompletedTop3] = useState<number[]>(briefing.completedTop3);
  useEffect(() => { setCompletedTop3(briefing.completedTop3); }, [briefing.id]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => { setAuthToken(u ? await u.getIdToken() : null); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authToken) return;
    fetch(`/api/integrations/gmail?filter=${emailFilter}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json()).then(d => { setGmailThreads(d.threads ?? []); setGmailConnected(d.connected ?? false); })
      .catch(() => {});
  }, [authToken, emailFilter]);

  useEffect(() => {
    if (!authToken) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/integrations/calendar?tz=${encodeURIComponent(tz)}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json()).then(d => { setCalendarEvents(d.events ?? []); setCalendarConnected(d.connected ?? false); })
      .catch(() => {});
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    fetch('/api/briefing/news', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json()).then(d => { setNewsItems(d.items ?? []); setNewsIndustry(d.industry ?? ''); })
      .catch(() => {});
  }, [authToken]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'desc')),
      snap => setHabits(snap.docs.map(d => ({
        id: d.id, title: d.data().title ?? 'Untitled', streak: d.data().streak ?? 0,
        completedDates: d.data().completedDates ?? [],
        done: (d.data().completedDates ?? []).includes(todayStr),
      }))),
      () => {},
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'tasks'), where('done', '==', false), where('deleted', '==', false)),
      snap => setDueTodayCount(snap.docs.filter(d => { const dd = d.data().dueDate ?? ''; return dd !== '' && dd <= todayStr; }).length),
      () => {},
    );
    return unsub;
  }, [user]);

  async function toggleHabit(h: { id: string; completedDates: string[] }) {
    if (!user) return;
    const done = h.completedDates.includes(todayStr);
    const newDates = done ? h.completedDates.filter(d => d !== todayStr) : [...h.completedDates, todayStr];
    const sorted = [...newDates].sort().reverse();
    let streak = 0;
    const check = new Date();
    for (const d of sorted) { if (d === check.toISOString().slice(0,10)) { streak++; check.setDate(check.getDate()-1); } else break; }
    await updateDoc(doc(db, 'users', user.uid, 'habits', h.id), { completedDates: newDates, streak });
  }

  async function toggleTop3(index: number) {
    if (!user) return;
    const next = completedTop3.includes(index) ? completedTop3.filter(i => i !== index) : [...completedTop3, index];
    setCompletedTop3(next);
    await updateDoc(doc(db, 'users', user.uid, 'conversations', briefing.id), { completedTop3: next });
  }

  async function handleConnectGoogle() {
    if (!authToken) return;
    const res = await fetch('/api/auth/google/connect', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  const initialMessages: Message[] = [{ id: `briefing-${briefing.id}`, role: 'assistant', content: briefing.content }];

  const { messages, input, handleInputChange, append, isLoading, setInput, setMessages } = useChat({
    api: '/api/chat', initialMessages, id: briefing.id,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: {
      personalContext: settings.personalContext ?? '', responseStyle: settings.responseStyle ?? 'normal',
      customStyle: settings.customStyle ?? '', briefingHour: settings.briefingHour ?? 7,
      briefingTimezone: settings.briefingTimezone ?? 'UTC',
    },
  });

  useEffect(() => { setMessages(initialMessages); savedLengthRef.current = 1; }, [briefing.id]);

  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!justFinished || messages.length <= 1 || !user) return;
    if (messages.length <= savedLengthRef.current) return;
    savedLengthRef.current = messages.length;
    saveMessages(briefing.id, messages);
  }, [isLoading, messages, briefing.id, saveMessages, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const chatMessages = messages.slice(1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const val = input.trim(); setInput('');
    await append({ role: 'user', content: val });
  }

  function handleChip(fill: string) {
    if (fill) setInput(fill);
    else document.querySelector<HTMLInputElement>('input[placeholder*="Type anything"]')?.focus();
  }

  function handleDraftReply(thread: GmailThread) {
    const content = `Write a draft reply for this email directly in chat — no approval card, just the reply text I can copy. When I say "send it" or "ok send", generate a send_email approval card with type "send_email", to: "${thread.fromAddress}", subject: "${thread.subject}", threadId: "${thread.id}", and body = the draft text.\n\nFrom: ${thread.from} <${thread.fromAddress}>\nSubject: ${thread.subject}\n\n${thread.body || thread.snippet}`;
    append({ role: 'user', content });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  // Derived
  const data = briefing.briefingData;
  const energyOpt = ENERGY_OPTS.find(o => o.key === briefing.energy);
  const speechText = briefingToSpeech(data, briefing.content);
  const { speaking, toggle: toggleSpeech } = useSpeech(speechText);
  const yesterday = useYesterdayStats(user?.uid ?? null);
  const weather = useWeather();
  const habitsDone = habits.filter(h => h.done).length;
  const habitsTotal = habits.length;
  const habitPct = habitsTotal > 0 ? habitsDone / habitsTotal : 1;
  const dayScore = Math.round(25 + (briefing.energy ? 25 : 0) + habitPct * 50);
  const meetings = calendarEvents.filter(e => !e.allDay).length;
  const unreadCount = gmailThreads.filter(t => t.unread).length;

  return (
    <div className="flex-1 overflow-y-auto bg-bg" style={{ backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(245,158,11,0.04) 0%, transparent 65%)' }}>
      <div className="px-6 py-10 max-w-5xl mx-auto">

        {autoGenerating && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 border border-brand/20 rounded-xl text-[12px] text-brand mb-6">
            <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
            Generating today&apos;s briefing…
          </div>
        )}

        {/* Full-width header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }} className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted mb-3">Morning Briefing</p>
              <h1 className="text-3xl font-bold text-text leading-tight mb-4">{fmtHeader(briefing.createdAt)}</h1>
              {/* Narrative paragraph or opening line headline */}
              {data?.narrative ? (
                <p className="text-[15px] text-text/80 leading-relaxed mb-1">{data.narrative}</p>
              ) : data?.openingLine ? (
                <p className="text-[15px] text-text/80 leading-relaxed mb-1">{data.openingLine}</p>
              ) : null}
              {/* Yesterday recap */}
              {yesterday && (yesterday.tasksDone > 0 || yesterday.habitsDone > 0) && (
                <p className="text-xs text-muted mt-1.5">
                  Yesterday:{' '}
                  {yesterday.tasksDone > 0 && <span className="text-text/70">{yesterday.tasksDone} task{yesterday.tasksDone !== 1 ? 's' : ''} done</span>}
                  {yesterday.tasksDone > 0 && yesterday.habitsDone > 0 && <span> · </span>}
                  {yesterday.habitsDone > 0 && <span className="text-text/70">{yesterday.habitsDone}/{yesterday.habitsTotal} habits</span>}
                </p>
              )}
              {/* Stats banner */}
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {dueTodayCount > 0 && (
                  <span className="text-[11px] text-muted bg-bg border border-border px-2.5 py-1 rounded-lg">
                    <span className="text-text font-semibold">{dueTodayCount}</span> task{dueTodayCount !== 1 ? 's' : ''} due
                  </span>
                )}
                {meetings > 0 && (
                  <span className="text-[11px] text-muted bg-bg border border-border px-2.5 py-1 rounded-lg">
                    <span className="text-text font-semibold">{meetings}</span> meeting{meetings !== 1 ? 's' : ''}
                  </span>
                )}
                {habitsTotal > 0 && habitsDone < habitsTotal && (
                  <span className="text-[11px] text-muted bg-bg border border-border px-2.5 py-1 rounded-lg">
                    <span className="text-text font-semibold">{habitsTotal - habitsDone}</span> habit{(habitsTotal - habitsDone) !== 1 ? 's' : ''} pending
                  </span>
                )}
                {unreadCount > 0 && (
                  <span className="text-[11px] text-muted bg-bg border border-border px-2.5 py-1 rounded-lg">
                    <span className="text-text font-semibold">{unreadCount}</span> unread
                  </span>
                )}
                {weather && (
                  <span className="text-[11px] text-muted bg-bg border border-border px-2.5 py-1 rounded-lg">
                    {weatherEmoji(weather.desc)} {weather.temp}{weather.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Score + controls */}
            <div className="flex items-center gap-2 shrink-0">
              <DayScoreRing score={dayScore} />
              <button onClick={toggleSpeech} title={speaking ? 'Stop' : 'Listen'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${speaking ? 'border-brand/40 bg-brand/10 text-brand' : 'border-border bg-panel text-muted hover:text-text'}`}>
                {speaking
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                }
                {speaking ? 'Stop' : 'Listen'}
              </button>
              {briefing.energy && energyOpt && (
                <div className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5">
                  <span className="text-amber-500"><IconBolt /></span>
                  <span className="text-[12px] font-medium text-muted hidden sm:inline">{energyOpt.emoji} {energyOpt.label}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Main content */}
        {data ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-5 items-start">
            {/* Left: reading column */}
            <div className="space-y-3">
              <FadeCard delay={0.05}>
                <ScheduleTimeline events={calendarEvents} schedule={data.schedule ?? []} connected={calendarConnected} onConnectGoogle={handleConnectGoogle} />
              </FadeCard>
              <FadeCard delay={0.10}>
                <ApprovalQueueCard threads={gmailThreads} connected={gmailConnected} filter={emailFilter}
                  onFilterChange={setEmailFilter} onConnectGoogle={handleConnectGoogle} onDraftReply={handleDraftReply} />
              </FadeCard>
              {data.looseEnd && (
                <FadeCard delay={0.15}><LooseEndCard text={data.looseEnd.text} onHandle={() => setInput(`Handle: ${data.looseEnd!.text}`)} /></FadeCard>
              )}
              {data.patternCallout && (
                <FadeCard delay={0.18}><PatternCard text={data.patternCallout} /></FadeCard>
              )}
              <FadeCard delay={0.22}><NewsCard items={newsItems} industry={newsIndustry} /></FadeCard>
            </div>
            {/* Right: sticky action panel */}
            <div className="space-y-3 lg:sticky lg:top-6">
              {data.top3.length > 0 && (
                <FadeCard delay={0.03}><MissionCard task={data.top3[0].task} source={data.top3[0].source} /></FadeCard>
              )}
              <FadeCard delay={0.07}>
                <EnergyCard energy={briefing.energy} onSelect={(key, chatMsg) => { onEnergySelect(key); append({ role: 'user', content: chatMsg }); }} />
              </FadeCard>
              {data.top3.length > 0 && (
                <FadeCard delay={0.11}>
                  <CheckableTop3Card items={data.top3} completedIndices={completedTop3} onToggle={toggleTop3} />
                </FadeCard>
              )}
              <FadeCard delay={0.15}>
                <InlineBriefingHabits habits={habits} onToggle={toggleHabit} />
              </FadeCard>
            </div>
          </div>
        ) : (
          <FadeCard delay={0.05}>
            <BCard>
              <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                {briefing.content || 'Briefing content unavailable. Try generating a new one.'}
              </p>
            </BCard>
          </FadeCard>
        )}

        {/* Follow-up chat messages */}
        {chatMessages.length > 0 && (
          <div className="space-y-2.5 pt-4 mt-1">
            {chatMessages.map((m, idx) => {
              const raw = typeof m.content === 'string' ? m.content : '';
              if (raw.startsWith('Write a draft reply for this email directly in chat')) {
                const sub = raw.match(/Subject: ([^\n]+)/);
                return <MessageBubble key={m.id} message={{ ...m, content: `Draft a reply → ${sub?.[1]?.trim() ?? 'email'}` }} />;
              }
              const isStreaming = isLoading && idx === chatMessages.length - 1 && m.role === 'assistant';
              return <MessageBubble key={m.id} message={m} isStreaming={isStreaming} />;
            })}
            {isLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
              <div className="flex gap-1 px-1">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />

        <div className="mt-4">
          <FadeCard delay={0.42}>
            <ClosingChatBar input={input} onChange={handleInputChange} onSubmit={handleSubmit} onChip={handleChip} isLoading={isLoading} />
          </FadeCard>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyBriefing() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setGenerating(true); setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/briefing/generate', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(await res.text());
    } catch { setError('Something went wrong. Try again.'); setGenerating(false); }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <span className="text-4xl">◎</span>
      <h2 className="text-lg font-semibold text-text">No briefings yet</h2>
      <p className="text-sm text-muted max-w-xs">Your first briefing will arrive at your scheduled time, or generate one now.</p>
      <button onClick={generate} disabled={generating}
        className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-60 flex items-center gap-2">
        {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {generating ? 'Generating...' : 'Generate briefing now'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
