'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect, type ReactNode } from 'react';

type Step = {
  num: string;
  label: string;
  desc: string;
  detail: string;
  icon: ReactNode;
  visual: ReactNode;
};

const chip = (t: string, on = false) => (
  <span
    key={t}
    className={`text-xs px-2.5 py-1 rounded-full ${on ? 'bg-brand/15 text-brand-light ring-1 ring-brand/25' : 'bg-bg text-muted'}`}
  >
    {t}
  </span>
);

const row = (t: string, i: number) => (
  <div key={t} className="flex items-center gap-2.5 text-sm text-text/90">
    <span className="grid place-items-center w-4 h-4 rounded-full bg-brand/20 text-brand-light shrink-0">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
    </span>
    {t}
  </div>
);

const STEPS: Step[] = [
  {
    num: '01',
    label: 'Every model',
    desc: 'Write with Gemini, research with Claude, ask ChatGPT. One subscription gets you every provider, and MODUS routes each task to whichever one does it best.',
    detail: 'ChatGPT · Claude · Gemini · Llama · Auto-routed',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="m3 12 9 4.5L21 12" /></svg>
    ),
    visual: (
      <div className="w-full space-y-2.5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted/70 mb-1">Routed to</div>
        {[
          ['Claude', 'Deep research', true],
          ['Gemini', 'Long-form writing', false],
          ['GPT-5.6', 'Quick answers', false],
        ].map(([m, use, on]) => (
          <div key={m as string} className={`flex items-center justify-between rounded-lg px-3 py-2 ${on ? 'bg-brand/12 ring-1 ring-brand/25' : 'bg-bg'}`}>
            <span className="text-sm font-semibold text-text">{m}</span>
            <span className="text-xs text-muted">{use}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '02',
    label: 'Monitor',
    desc: 'It reads your calendar, inbox, goals, and habits in real time — drafting replies, detecting conflicts, and surfacing what actually matters today.',
    detail: 'Gmail · Calendar · Pattern recognition · Priority scoring',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></svg>
    ),
    visual: (
      <div className="w-full space-y-2">
        {['3 emails need a reply', 'Calendar conflict at 2 PM', 'Habit streak at risk — gym'].map(row)}
        <div className="mt-1 flex flex-wrap gap-1.5 pt-1">{['Gmail', 'Calendar', 'Priority'].map((t) => chip(t))}</div>
      </div>
    ),
  },
  {
    num: '03',
    label: 'Approve',
    desc: 'Every decision surfaces as an approval card. You see exactly what MODUS plans to do, edit anything you want, and nothing runs without your sign-off.',
    detail: 'Approval cards · Edit · Skip · Always in control',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4.5 6v5.5c0 4.3 3.1 7.6 7.5 9 4.4-1.4 7.5-4.7 7.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4.5" /></svg>
    ),
    visual: (
      <div className="w-full rounded-xl bg-bg ring-1 ring-border/70 p-3.5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-light mb-2.5">Approval required</div>
        <div className="space-y-2">
          {['Draft reply to Marcus', 'Block 9–12 as deep work', 'Move 3 PM to Friday'].map(row)}
        </div>
        <div className="mt-3 flex gap-2">
          <span className="btn-primary flex-1 text-center text-white text-xs font-bold py-2 rounded-lg">Approve all</span>
          <span className="flex-1 text-center text-muted text-xs font-semibold py-2 rounded-lg bg-panel ring-1 ring-border/70">Edit</span>
        </div>
      </div>
    ),
  },
  {
    num: '04',
    label: 'Execute',
    desc: 'You click approve. It fires instantly across your tools — email sent, calendar updated, task logged. You move on with your day.',
    detail: 'Cross-app execution · Instant sync · Audit trail',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" /></svg>
    ),
    visual: (
      <div className="w-full space-y-2">
        {[['Email sent to Marcus', 'now'], ['Calendar updated', 'now'], ['Task logged · Q3 roadmap', 'now']].map(([t, when]) => (
          <div key={t} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-4 h-4 rounded-full bg-emerald-400/20 text-emerald-400 shrink-0">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
              </span>
              <span className="text-sm text-text/90">{t}</span>
            </div>
            <span className="text-[10px] text-muted uppercase tracking-wide">{when}</span>
          </div>
        ))}
      </div>
    ),
  },
];

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
    resumeRef.current = setTimeout(() => setPaused(false), 6000);
  };

  const step = STEPS[active];

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
            How MODUS works
          </h2>
          <p className="text-muted text-lg">Four steps. Zero micromanagement.</p>
        </motion.div>

        {/* Step tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => goTo(i)}
              className={`relative text-left p-4 rounded-xl transition-all duration-300 overflow-hidden ${
                active === i ? 'bg-panel ring-1 ring-brand/25' : 'bg-panel/40 hover:bg-panel/70'
              }`}
            >
              <div className={`text-[10px] font-bold mb-1 tracking-widest ${active === i ? 'text-brand' : 'text-muted/60'}`}>{s.num}</div>
              <div className={`text-sm font-bold ${active === i ? 'text-text' : 'text-muted'}`}>{s.label}</div>
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

        {/* Active step: text on the left, a live-feel visual on the right */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-panel rounded-2xl ring-1 ring-border/60 p-7 md:p-9 grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand/12 text-brand-light ring-1 ring-brand/20 [&_svg]:w-5 [&_svg]:h-5">
                {step.icon}
              </span>
              <div>
                <div className="text-[10px] font-bold text-brand uppercase tracking-widest">{step.num}</div>
                <h3 className="text-xl font-semibold tracking-tight text-text leading-none mt-0.5">{step.label}</h3>
              </div>
            </div>
            <p className="text-base text-muted leading-relaxed mb-4 max-w-md">{step.desc}</p>
            <div className="flex flex-wrap gap-2">{step.detail.split(' · ').map((d) => chip(d))}</div>
          </div>

          {/* the visual panel — fills what used to be dead space */}
          <div className="relative rounded-xl bg-bg/60 ring-1 ring-border/60 p-4 md:p-5 min-h-[196px] flex items-center">
            {step.visual}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
