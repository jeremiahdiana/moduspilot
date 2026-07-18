'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface Props {
  label: string;
  foundingNumber: number;
  cap: number;
  /** Locked state shows the card face-down / sealed until they enter their key. */
  sealed?: boolean;
}

// A tactile, numbered membership card — holographic foil, guilloché lines, and a
// 3D tilt with a glare that tracks the pointer. This is the artifact people
// screenshot: their name, their number, out of 100.
export default function FoundingCard({ label, foundingNumber, cap, sealed = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rY = useSpring(useTransform(px, [0, 1], [-13, 13]), { stiffness: 140, damping: 14 });
  const rX = useSpring(useTransform(py, [0, 1], [11, -11]), { stiffness: 140, damping: 14 });

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    px.set(x); py.set(y);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  }
  function onLeave() { px.set(0.5); py.set(0.5); }

  const num = String(foundingNumber).padStart(3, '0');

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rX, rotateY: rY, transformPerspective: 1000 }}
      className="fm-card w-full max-w-[360px] aspect-[1.6/1] p-6 flex flex-col justify-between select-none"
    >
      <div className="fm-card-foil" />
      <div className="fm-card-lines" />
      <div className="fm-card-glare" />

      {/* top row */}
      <div className="relative flex items-center justify-between" style={{ transform: 'translateZ(40px)' }}>
        <div className="flex items-center gap-2">
          <Image src="/logo-dark.png" alt="" width={26} height={20} className="object-contain opacity-95" />
          <span className="text-[11px] font-black tracking-[0.32em] text-white/85">MODUS</span>
        </div>
        <span className="text-[9px] font-semibold tracking-[0.28em] text-violet-200/70 uppercase">Pilot · Founding</span>
      </div>

      {/* number */}
      <div className="relative" style={{ transform: 'translateZ(55px)' }}>
        <p className="text-[10px] font-semibold tracking-[0.34em] uppercase text-violet-200/70 mb-1">
          {sealed ? 'Founding Member' : 'Founding Member'}
        </p>
        <div className="flex items-end gap-2">
          <span className="fm-foil-text fm-emboss text-2xl font-black leading-none pb-1">No.</span>
          <span className="fm-foil-text fm-emboss text-6xl font-black leading-none tracking-tight">
            {sealed ? '•••' : num}
          </span>
        </div>
      </div>

      {/* bottom row */}
      <div className="relative flex items-end justify-between" style={{ transform: 'translateZ(40px)' }}>
        <div>
          <p className="text-[9px] font-medium tracking-[0.22em] uppercase text-white/40">Member</p>
          <p className="fm-emboss text-sm font-semibold tracking-wide text-white/95">
            {sealed ? '— — —' : (label || 'Founding Member')}
          </p>
        </div>
        <p className="fm-emboss text-sm font-bold tracking-wide text-violet-200/80">/ {cap}</p>
      </div>
    </motion.div>
  );
}
