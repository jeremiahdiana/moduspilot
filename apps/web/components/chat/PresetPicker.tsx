'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { Preset } from '@/hooks/useUserSettings';

interface Props {
  presets: Preset[];
  activeIds: Set<string>;
  onToggle: (id: string) => void;
}

// Sits next to the ModelSwitcher in the composer toolbar. Lets the user flip on
// reusable prompt directives (e.g. "no em dashes", "8th-grade diction") for the
// current thread. The active preset texts are sent with the next message and
// injected into the system prompt server-side (see buildPresetsBlock). Presets
// are created/edited in Settings → General.
export default function PresetPicker({ presets, activeIds, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const activeCount = presets.filter(p => activeIds.has(p.id)).length;
  const on = activeCount > 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-xs border rounded-lg px-2 py-1 transition-colors max-w-[9rem] ${
          on ? 'text-brand border-brand/40 bg-brand/10' : 'text-muted hover:text-text border-border'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
          <path d="M4 6h10M4 12h16M4 18h7" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="14" cy="18" r="2" />
        </svg>
        <span className="truncate font-medium">{on ? `${activeCount} preset${activeCount === 1 ? '' : 's'}` : 'Presets'}</span>
        <motion.svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 shrink-0"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-0 mb-2 w-64 origin-bottom-left bg-panel border border-border rounded-xl shadow-lg py-1.5 z-50 max-h-80 overflow-y-auto"
          >
            <div className="px-3 pt-1.5 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">Presets</p>
            </div>

            {presets.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted leading-snug">
                No presets yet. Create reusable directives in Settings.
              </p>
            ) : (
              presets.map(p => {
                const active = activeIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle(p.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-brand/5 transition-colors ${active ? 'bg-brand/5' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${active ? 'text-brand' : 'text-text'}`}>{p.label}</p>
                      <p className="text-xs text-muted truncate">{p.text}</p>
                    </div>
                    <span className={`shrink-0 w-8 rounded-full relative flex items-center px-0.5 transition-colors ${active ? 'bg-brand justify-end' : 'bg-border justify-start'}`} style={{ height: 18 }}>
                      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className="w-3.5 h-3.5 rounded-full bg-white" />
                    </span>
                  </button>
                );
              })
            )}

            <div className="my-1 border-t border-border/60" />
            <Link
              href="/settings?tab=general"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-muted hover:text-text transition-colors"
            >
              Manage presets in Settings
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
