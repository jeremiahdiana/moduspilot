'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GridLayout, Layout, LayoutItem } from 'react-grid-layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { useDashboard, DashboardWidget } from '@/hooks/useDashboard';
import GoalCard from './GoalCard';
import HabitTracker from './HabitTracker';
import TaskList from './TaskList';
import StreakWidget from './StreakWidget';
import BriefingWidget from './BriefingWidget';

const CORE_TYPES: DashboardWidget['type'][] = ['goals', 'habits', 'tasks', 'streak', 'briefing'];

const CATALOG: { type: DashboardWidget['type']; title: string; available: boolean; icon: string }[] = [
  { type: 'goals',      title: 'Goals',      available: true,  icon: '◈' },
  { type: 'habits',     title: 'Habits',     available: true,  icon: '◉' },
  { type: 'tasks',      title: 'Tasks',      available: true,  icon: '☑' },
  { type: 'streak',     title: 'Streaks',    available: true,  icon: '🔥' },
  { type: 'briefing',   title: 'Briefing',   available: true,  icon: '◎' },
  { type: 'quick_chat', title: 'Quick Chat', available: false, icon: '◎' },
  { type: 'gmail',      title: 'Gmail',      available: false, icon: '✉' },
  { type: 'calendar',   title: 'Calendar',   available: false, icon: '▦' },
  { type: 'notes',      title: 'Notes',      available: false, icon: '☰' },
  { type: 'finance',    title: 'Finance',    available: false, icon: '◆' },
];

function WidgetContent({ type }: { type: DashboardWidget['type'] }) {
  switch (type) {
    case 'goals':    return <GoalCard />;
    case 'habits':   return <HabitTracker />;
    case 'tasks':    return <TaskList />;
    case 'streak':   return <StreakWidget />;
    case 'briefing': return <BriefingWidget />;
    default:         return null;
  }
}

function toLayout(widgets: DashboardWidget[]): LayoutItem[] {
  return widgets.map((w, i) => ({
    i: w.id,
    x: w.layout?.x ?? (i % 2) * 6,
    y: w.layout?.y ?? Math.floor(i / 2) * 5,
    w: w.layout?.w ?? 6,
    h: w.layout?.h ?? 5,
    minW: 3,
    minH: 3,
  }));
}

export default function DashboardGrid() {
  const { user } = useAuth();
  const { widgets, loading, updateLayout, addWidget, removeWidget, renameWidget } = useDashboard(user?.uid ?? null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => obs.disconnect();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus rename input
  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  function startRename(widget: DashboardWidget) {
    setRenameValue(widget.title);
    setRenaming(widget.id);
    setOpenMenu(null);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) renameWidget(id, renameValue.trim());
    setRenaming(null);
  }

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    updateLayout(Array.from(newLayout).map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
  }, [updateLayout]);

  const addedTypes = new Set(widgets.map(w => w.type));

  return (
    <div ref={containerRef} className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!loading && <GridLayout
        layout={toLayout(widgets)}
        width={containerWidth}
        gridConfig={{ cols: 12, rowHeight: 50, margin: [16, 16], containerPadding: [0, 0] }}
        dragConfig={{ enabled: true, handle: '.drag-handle', threshold: 5, bounded: false }}
        resizeConfig={{ enabled: true, handles: ['se'] }}
        onLayoutChange={handleLayoutChange}
        autoSize
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className="bg-panel border border-border rounded-2xl flex flex-col overflow-hidden group/widget"
          >
            {/* Drag handle / header */}
            <div className="drag-handle flex items-center justify-between px-5 pt-4 pb-2 shrink-0 cursor-grab active:cursor-grabbing select-none">
              {renaming === widget.id ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(widget.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(widget.id);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className="flex-1 bg-bg border border-brand/40 rounded-lg px-2 py-1 text-sm text-text focus:outline-none mr-2 cursor-text"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <h2 className="text-sm font-semibold text-text">{widget.title}</h2>
              )}

              {/* 3-dot menu */}
              <div
                className="relative shrink-0"
                ref={openMenu === widget.id ? menuRef : undefined}
              >
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === widget.id ? null : widget.id);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-muted hover:text-text rounded transition-colors opacity-0 group-hover/widget:opacity-100"
                  title="Widget options"
                >
                  ···
                </button>
                {openMenu === widget.id && (
                  <div className="absolute right-0 top-7 z-50 bg-panel border border-border rounded-xl overflow-hidden shadow-lg w-36">
                    {!CORE_TYPES.includes(widget.type) && (
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); startRename(widget); }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-bg transition-colors text-left"
                      >
                        <span className="text-xs">✎</span> Rename
                      </button>
                    )}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); removeWidget(widget.id); setOpenMenu(null); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/10 transition-colors text-left border-t border-border"
                    >
                      <span className="text-xs">✕</span> Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Widget content */}
            <div className="flex-1 overflow-hidden px-5 pb-4 min-h-0">
              <WidgetContent type={widget.type} />
            </div>
          </div>
        ))}
      </GridLayout>}

      {/* Add section button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full h-14 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-muted hover:text-text hover:border-brand/40 transition-colors group"
      >
        <span className="text-xl group-hover:scale-110 transition-transform">+</span>
        <span className="text-sm font-medium">Add section</span>
      </button>

      {/* Add section modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-panel border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-text">Add section</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-text transition-colors"
              >✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATALOG.map(item => {
                const isAdded = addedTypes.has(item.type);
                const disabled = !item.available || isAdded;
                return (
                  <button
                    key={item.type}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      addWidget({ id: item.type, type: item.type, title: item.title });
                      setShowAddModal(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      disabled
                        ? 'border-border bg-bg opacity-50 cursor-not-allowed'
                        : 'border-border bg-bg hover:border-brand/50 hover:bg-brand/5 cursor-pointer'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{item.title}</p>
                      {!item.available && <p className="text-[10px] text-muted">Soon</p>}
                      {isAdded && item.available && <p className="text-[10px] text-brand">Added</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted mt-4 text-center">
              You can also ask MODUS in chat to add or remove sections.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
