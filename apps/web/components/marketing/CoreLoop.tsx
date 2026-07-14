'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

const STEPS = [
  {
    num: '01',
    label: 'Every model',
    desc: 'Write with Gemini, research with Claude, ask ChatGPT. One subscription gets you every frontier model, and MODUS routes each task to whichever one does it best.',
    detail: 'ChatGPT · Claude · Gemini · Grok · Auto-routed',
  },
  {
    num: '02',
    label: 'Monitor',
    desc: 'It reads your calendar, inbox, goals, and habits in real time, drafting replies, detecting conflicts, and surfacing what actually matters today.',
    detail: 'Gmail · Calendar · Pattern recognition · Priority scoring',
  },
  {
    num: '03',
    label: 'Approve',
    desc: 'Every decision surfaces as an approval card. You see exactly what MODUS plans to do, edit anything you want, and nothing runs without your sign-off.',
    detail: 'Approval cards · Edit · Skip · Always in control',
  },
  {
    num: '04',
    label: 'Execute',
    desc: 'You click approve. It fires instantly across your tools. Email sent, calendar updated, task logged. You move on with your day.',
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
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-text mb-4">
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
              className={`relative text-left p-4 rounded-xl transition-all duration-300 overflow-hidden ${
                active === i ? 'bg-panel' : 'bg-panel/40 hover:bg-panel/70'
              }`}
            >
              <div className={`text-[10px] font-bold mb-1 tracking-widest ${active === i ? 'text-brand' : 'text-muted/60'}`}>{step.num}</div>
              <div className={`text-sm font-bold ${active === i ? 'text-text' : 'text-muted'}`}>{step.label}</div>
              {/* Progress bar. The CSS animation drives both the fill and the
                  auto-advance (onAnimationEnd), so there's no per-frame React render */}
              {active === i && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text/10">
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

        {/* Active step content, keyed so it swaps instantly on click (no exit
            wait); the new card just fades in */}
        <div>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-panel rounded-2xl p-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="mb-4">
                  <div className="text-xs font-bold text-brand uppercase tracking-widest mb-1">{STEPS[active].num}</div>
                  <h3 className="text-2xl font-semibold tracking-tight text-text">{STEPS[active].label}</h3>
                </div>
                <p className="text-base text-muted leading-relaxed mb-4 max-w-lg">
                  {STEPS[active].desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STEPS[active].detail.split(' · ').map(d => (
                    <span key={d} className="text-xs text-muted bg-bg px-2.5 py-1 rounded-full">
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
                      i === active ? 'h-8 bg-brand' : 'h-1.5 bg-text/15 hover:bg-text/30'
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
