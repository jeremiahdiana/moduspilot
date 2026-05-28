'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

interface DeckViewerProps {
  slides: React.ReactNode[];
  label?: string;
}

export default function DeckViewer({ slides, label }: DeckViewerProps) {
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);
  const total = slides.length;

  const go = useCallback((idx: number) => {
    if (idx < 0 || idx >= total) return;
    setDir(idx > current ? 1 : -1);
    setCurrent(idx);
  }, [current, total]);

  const next = useCallback(() => go(current + 1), [current, go]);
  const prev = useCallback(() => go(current - 1), [current, go]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    if (x > window.innerWidth / 2) next();
    else prev();
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden select-none" onClick={handleClick}>
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(124,58,237,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(124,58,237,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 pointer-events-none">
        <Link href="/" onClick={e => e.stopPropagation()} className="pointer-events-auto flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <Image src="/logo-dark.png" alt="MODUS" width={36} height={28} className="object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-widest text-[#7c3aed]">MODUS</span>
            <span className="text-[7px] font-semibold text-white/40 tracking-widest uppercase">pilot</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {label && <span className="text-white/30 text-xs tracking-widest uppercase">{label}</span>}
          <span className="text-white/40 text-sm font-mono">{current + 1} / {total}</span>
          <Link
            href="/"
            onClick={e => e.stopPropagation()}
            className="pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all text-sm"
          >
            ×
          </Link>
        </div>
      </div>

      {/* Slides */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={current}
          custom={dir}
          initial={{ opacity: 0, y: dir * 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dir * -24 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center px-8 sm:px-16 pt-20 pb-16"
        >
          {slides[current]}
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); go(i); }}
            className={`pointer-events-auto rounded-full transition-all duration-300 ${
              i === current
                ? 'w-5 h-1.5 bg-[#7c3aed]'
                : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Nav arrows (desktop) */}
      {current > 0 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex w-10 h-10 items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all"
        >
          ←
        </button>
      )}
      {current < total - 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex w-10 h-10 items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all"
        >
          →
        </button>
      )}
    </div>
  );
}
