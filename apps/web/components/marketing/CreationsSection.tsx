'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

/**
 * What a message turns into — played, not pictured.
 *
 * The point of the section is that MODUS MAKES things, so it has to be caught in
 * the act: ask -> thinking -> building with real progress -> the artifact
 * arriving. A finished screenshot proves nothing; anyone can paste a picture of
 * a chart. Each tab runs itself and hands over to the next, so a visitor who
 * scrolls here and does nothing still sees all three.
 *
 * Everything shown is REAL:
 *  - the image is genuinely MODUS output (public/made-by-modus.png, from
 *    gpt-image-1 via the same path /api/generate/image uses) and the prompt on
 *    screen is the prompt that made it;
 *  - the chart is a live recharts render, the same library ChartCard uses;
 *  - the document stage mirrors the real DocumentEditor (markdown left, rendered
 *    right, export to PDF), because editing what MODUS wrote is a shipped
 *    feature and a file chip alone hid it.
 *
 * Only add a tab for something chat emits TODAY (image | chart | document |
 * approval | options). Gamma-style decks and Cal AI logging are the unbuilt
 * modes plan; a tab here would be a promise.
 */

const CHART_DATA = [
  { label: 'Mon', Deep: 3.5, Meetings: 1.0 },
  { label: 'Tue', Deep: 2.0, Meetings: 3.5 },
  { label: 'Wed', Deep: 4.5, Meetings: 0.5 },
  { label: 'Thu', Deep: 1.5, Meetings: 4.0 },
  { label: 'Fri', Deep: 5.0, Meetings: 1.0 },
];

type TabId = 'image' | 'chart' | 'doc';
type Stage = 'ask' | 'thinking' | 'building' | 'done';

const TABS: { id: TabId; label: string; ask: string; building: string; model: string }[] = [
  { id: 'image', label: 'An image',    ask: 'Generate an image of a lone climber at dawn', building: 'Generating image', model: 'gpt-image-1' },
  { id: 'chart', label: 'A chart',     ask: 'Chart my deep work vs meetings this week',    building: 'Building chart',   model: 'Claude Sonnet' },
  { id: 'doc',   label: 'A document',  ask: 'Turn my Q3 notes into a PDF I can send',      building: 'Writing document', model: 'Claude Sonnet' },
];

/** How long each tab holds the stage before handing to the next. */
const TAB_MS = 11000;

const STAGE_AT: Record<Exclude<Stage, 'ask'>, number> = {
  thinking: 500,
  building: 1400,
  done: 3600,
};

function Dots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-brand"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.14 }}
        />
      ))}
    </span>
  );
}

/** The real progress chrome from chat: a labelled bar with a live percentage. */
function BuildingBar({ label, detail, stage }: { label: string; detail: string; stage: Stage }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (stage !== 'building') { setPct(stage === 'done' ? 100 : 0); return; }
    const t0 = performance.now();
    const span = STAGE_AT.done - STAGE_AT.building;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / span);
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  return (
    <div className="px-4 py-3 rounded-xl bg-bg ring-1 ring-text/[0.06] min-w-[240px]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          {label}
          <span className="text-muted/60">· {detail}</span>
        </span>
        <span className="text-xs font-medium text-brand tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-text/[0.08] overflow-hidden">
        <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${pct}%` }} transition={{ duration: 0.15 }} />
      </div>
    </div>
  );
}

function ImageStage({ stage }: { stage: Stage }) {
  return (
    <div className="rounded-xl overflow-hidden bg-bg ring-1 ring-text/[0.06]">
      <div className="relative aspect-[16/10]">
        {/* The shimmer sits UNDER the image, which blurs up over it — so the
            reveal reads as the picture resolving rather than a swap. */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-brand/10 via-brand/[0.04] to-transparent"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <AnimatePresence>
          {stage === 'done' && (
            <motion.div
              initial={{ opacity: 0, scale: 1.06, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Image
                src="/made-by-modus.png"
                alt="A lone climber on a dark granite ridge at dawn, generated by MODUS"
                fill
                sizes="(max-width: 1024px) 100vw, 960px"
                // 95, not the default 75: this is a dark gradient sky and the
                // default quantiser bands it into visible stripes.
                quality={95}
                priority
                className="object-cover object-center"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {stage === 'done' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[11px] text-muted/70 flex-1">Actually made by MODUS, from that prompt. Not a stock photo.</span>
            <span className="text-[11px] font-semibold text-brand shrink-0">Download</span>
            <span className="text-[11px] text-muted shrink-0">Regenerate</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChartStage({ stage }: { stage: Stage }) {
  return (
    <div className="rounded-xl bg-bg ring-1 ring-text/[0.06] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-text">Deep work vs meetings · hours</p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-4 h-0.5 rounded-full bg-[#7C3AED]" /> Deep work
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-4 border-t-2 border-dashed border-[#a78bfa]" /> Meetings
          </span>
        </div>
      </div>
      <div className="h-[240px]">
        {stage === 'done' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={CHART_DATA} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: 'rgb(140,140,148)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis width={28} tick={{ fill: 'rgb(140,140,148)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgb(22,22,24)', border: '1px solid rgb(32,32,35)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'rgb(237,237,240)' }}
              />
              {/* Draws itself left to right — the line arriving is the point. */}
              <Line type="monotone" dataKey="Deep" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} animationDuration={1100} />
              <Line type="monotone" dataKey="Meetings" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} animationDuration={1100} animationBegin={200} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-end gap-2 pb-6 pl-8">
            {[40, 24, 52, 18, 58].map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t bg-text/[0.06]"
                animate={{ height: [`${h * 0.5}%`, `${h}%`, `${h * 0.5}%`] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted/70 mt-2">A live chart, not a screenshot. Same renderer you get in chat.</p>
    </div>
  );
}

const DOC_MD = ['# Q3 Review', '', 'Revenue grew **34%** against a flat headcount.', 'Churn fell to **2.1%**, the lowest this year.', '', '## Risk', 'Onboarding still takes 9 days.'];

function DocStage({ stage }: { stage: Stage }) {
  // Types the markdown in line by line, so the editor is caught mid-write.
  const [lines, setLines] = useState(0);
  useEffect(() => {
    if (stage !== 'done') { setLines(0); return; }
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setLines(i);
      if (i >= DOC_MD.length) clearInterval(iv);
    }, 130);
    return () => clearInterval(iv);
  }, [stage]);

  const shown = DOC_MD.slice(0, lines);

  return (
    <div className="rounded-xl bg-bg ring-1 ring-text/[0.06] overflow-hidden">
      {/* Editor chrome, mirroring the real DocumentEditor */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-text/[0.06]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
        </svg>
        <span className="text-sm font-semibold text-text flex-1 min-w-0 truncate">Q3-review.pdf</span>
        <span className="text-[11px] text-muted hidden sm:inline">Edit it before it goes out</span>
        <span className="text-[11px] font-semibold text-brand">Export PDF</span>
      </div>

      <div className="grid sm:grid-cols-2 divide-x divide-text/[0.06] min-h-[240px]">
        {/* Markdown source, typing in */}
        <div className="p-4 font-mono text-[11px] leading-relaxed text-muted space-y-0.5">
          {shown.map((l, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre">
              {l || ' '}
            </motion.div>
          ))}
          {stage === 'done' && lines < DOC_MD.length && (
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className="inline-block w-1.5 h-3 bg-brand align-middle" />
          )}
        </div>

        {/* Live rendered side, updating as the source lands */}
        <div className="p-4 space-y-2">
          {shown.map((l, i) => {
            if (!l) return <div key={i} className="h-1" />;
            if (l.startsWith('# ')) return <motion.h4 key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-base font-bold text-text">{l.slice(2)}</motion.h4>;
            if (l.startsWith('## ')) return <motion.h5 key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-text uppercase tracking-wide pt-1">{l.slice(3)}</motion.h5>;
            return (
              <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-muted leading-relaxed"
                dangerouslySetInnerHTML={{ __html: l.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text font-semibold">$1</strong>') }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CreationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-120px 0px' });
  const [tab, setTab] = useState<TabId>('image');
  const [stage, setStage] = useState<Stage>('ask');
  const [paused, setPaused] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = TABS.find(t => t.id === tab)!;

  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  // The stages and the hand-off are SEPARATE effects on purpose. Hovering pauses
  // the hand-off only; if it also drove the stages, pausing to look at the image
  // would restart the whole performance in your face, which is the opposite of
  // what hovering means. Nothing here depends on `paused`.
  useEffect(() => {
    if (!inView) { clear(); return; }
    setStage('ask');
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(STAGE_AT.thinking, () => setStage('thinking'));
    at(STAGE_AT.building, () => setStage('building'));
    at(STAGE_AT.done, () => setStage('done'));
    return clear;
  }, [tab, inView, clear]);

  // Hand-off. Skipped entirely while hovered, so reading never gets yanked away.
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!inView || paused) return;
    advance.current = setTimeout(() => {
      const i = TABS.findIndex(t => t.id === tab);
      setTab(TABS[(i + 1) % TABS.length].id);
    }, TAB_MS);
    return () => { if (advance.current) clearTimeout(advance.current); };
  }, [tab, inView, paused]);

  return (
    <section className="px-6 py-20 max-w-5xl mx-auto" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px 0px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-xs font-bold text-brand dark:text-brand-light uppercase tracking-widest mb-3">What it makes</p>
        <h2 className="text-4xl md:text-5xl font-semibold text-text mb-4 tracking-tight">
          It doesn&apos;t describe things.<br />
          <span className="text-brand dark:text-brand-light">It makes them.</span>
        </h2>
        <p className="text-muted text-lg leading-relaxed max-w-2xl mb-8">
          Ask in the same chat that reads your calendar. The answer comes back as the actual thing — rendered, editable, yours — not a paragraph telling you how to go make it.
        </p>
      </motion.div>

      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {/* Tabs, each with its own fill showing how long it holds the stage */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative overflow-hidden px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  on ? 'text-white' : 'bg-panel text-muted hover:text-text'
                }`}
              >
                {on && (
                  <>
                    <span className="absolute inset-0 bg-brand/25" />
                    {/* A CSS animation, not framer, because this bar has to
                        FREEZE where it is on hover. animation-play-state does
                        that exactly; a framer `animate` can only be told a new
                        target, so pausing made it jump to 100% and lie about
                        how much time was left. */}
                    <span
                      key={t.id}
                      className="absolute inset-y-0 left-0 bg-brand tab-fill"
                      style={{ animationDuration: `${TAB_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                    />
                  </>
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-panel rounded-2xl p-4 shadow-2xl shadow-black/30">
          {/* The ask */}
          <div className="flex justify-end mb-3">
            <motion.div
              key={`${tab}-ask`}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]"
            >
              <p className="text-sm leading-relaxed">{active.ask}</p>
            </motion.div>
          </div>

          {/* Routing chip — the same one chat shows, so the model doing the work is named */}
          <AnimatePresence>
            {stage !== 'ask' && (
              <motion.div
                key={`${tab}-routed`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px] text-muted mb-3"
              >
                <span>MODUS routed this to</span>
                <span className="px-1.5 py-0.5 rounded-md bg-bg text-text font-medium ring-1 ring-text/[0.08]">{active.model}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thinking → building → the thing */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              {stage === 'ask' || stage === 'thinking' ? (
                <motion.div key="think" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5 px-4 py-4">
                  <Dots />
                </motion.div>
              ) : (
                <motion.div key="work" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
                  <AnimatePresence>
                    {stage === 'building' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <BuildingBar label={active.building} detail={active.model} stage={stage} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {tab === 'image' ? <ImageStage stage={stage} /> : tab === 'chart' ? <ChartStage stage={stage} /> : <DocStage stage={stage} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
