'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

const STEPS = [
  {
    num: '01',
    label: 'Monitor',
    icon: '◉',
    color: 'from-violet-500/20 to-brand/10',
    desc: 'MODUS reads your calendar, inbox, goals, and habits in real time — building a live picture of your day before you even open your eyes.',
    detail: 'Gmail · Google Calendar · Goals · Habits · Tasks',
  },
  {
    num: '02',
    label: 'Decide',
    icon: '◈',
    color: 'from-brand/20 to-purple-500/10',
    desc: 'It runs quietly in the background — drafting replies, detecting conflicts, flagging patterns, surfacing what actually matters today.',
    detail: 'Pattern recognition · Priority scoring · Conflict detection',
  },
  {
    num: '03',
    label: 'Approve',
    icon: '◆',
    color: 'from-purple-500/20 to-violet-400/10',
    desc: 'Every decision surfaces as an approval card. You see exactly what MODUS plans to do, edit anything you want, and nothing runs without your sign-off.',
    detail: 'Approval cards · Edit · Skip · Always in control',
  },
  {
    num: '04',
    label: 'Execute',
    icon: '◎',
    color: 'from-violet-400/20 to-brand/10',
    desc: 'You click approve. It fires instantly across your tools — email sent, calendar updated, task logged. You move on with your day.',
    detail: 'Cross-app execution · Instant sync · Audit trail',
  },
];

const STEP_DURATION = 3000;

export default function CoreLoop() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(resumeRef.current), []);

  const advance = () => { if (!paused) setActive(a => (a + 1) % STEPS.length); };

  const goTo = (i: number) => {
    setActive(i);
    setPaused(true);
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setPaused(false), 5000);
  };

  return (
    <section id="how-it-works" className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(124,58,237,0.20),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(124,58,237,0.07),transparent)]" />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-black text-text mb-4">
            How MODUS Works
          </h2>
          <p className="text-muted text-lg">Four steps. Zero micromanagement.</p>
        </motion.div>

        {/* Step tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {STEPS.map((step, i) => (
            <button
              key={step.label}
              onClick={() => goTo(i)}
              className={`relative text-left p-4 rounded-xl border transition-all duration-300 overflow-hidden ${
                active === i
                  ? 'bg-panel border-brand/40 shadow-lg shadow-brand/10'
                  : 'bg-panel/40 border-border/50 hover:border-border'
              }`}
            >
              <div className="text-[10px] font-bold text-brand/60 mb-1 tracking-widest">{step.num}</div>
              <div className={`text-sm font-bold ${active === i ? 'text-text' : 'text-muted'}`}>{step.label}</div>
              {/* Progress bar — CSS animation drives both the fill and the
                  auto-advance (onAnimationEnd), so there's no per-frame React render */}
              {active === i && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30">
                  <div
                    key={active}
                    onAnimationEnd={advance}
                    className="h-full bg-brand rounded-full coreloop-progress"
                    style={{ animationPlayState: paused ? 'paused' : 'running' }}
                  />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Active step content — keyed so it swaps instantly on click (no exit
            wait); the new card just fades in */}
        <div>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`bg-panel border border-border/60 rounded-2xl p-10 bg-gradient-to-br ${STEPS[active].color}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center text-xl text-brand">
                    {STEPS[active].icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-brand/70 uppercase tracking-widest">{STEPS[active].num}</div>
                    <h3 className="text-2xl font-black text-text">{STEPS[active].label}</h3>
                  </div>
                </div>
                <p className="text-base text-muted leading-relaxed mb-4 max-w-lg">
                  {STEPS[active].desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STEPS[active].detail.split(' · ').map(d => (
                    <span key={d} className="text-xs text-brand/70 bg-brand/8 border border-brand/20 px-2.5 py-1 rounded-full">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              {/* Step dots indicator */}
              <div className="hidden md:flex flex-col items-center gap-2">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      i === active ? 'h-8 bg-brand' : 'h-1.5 bg-border hover:bg-brand/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
