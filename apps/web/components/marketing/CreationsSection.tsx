'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ProviderLogo } from '@/components/marketing/BrandLogos';
import { usePausableTimeout } from '@/hooks/usePausableTimeout';
import { markdownToHtml } from '@/lib/document';
import { modelName, PLATFORM_MODELS } from '@/lib/models';

/**
 * What a message turns into — played, not pictured.
 *
 * The point of the section is that MODUS MAKES things, so it has to be caught in
 * the act: ask -> routed -> building with real progress -> the artifact arriving.
 * A finished screenshot proves nothing; anyone can paste a picture of a chart.
 * Each tab runs itself and hands over to the next, so a visitor who scrolls here
 * and does nothing still sees all three.
 *
 * THE THREE TABS ARE DELIBERATELY NOT THE SAME SHAPE, and the difference is not
 * decoration — it is copied from lib/chat/block-progress.ts, which is what the
 * real chat shows while a block streams:
 *   - image    -> "Creating image", percent NULL. An indeterminate sweep, no
 *                 number, because there is nothing honest to count. The earlier
 *                 version of this section invented a timer-driven "48%" here,
 *                 which is the exact lie block-progress.ts refuses to tell.
 *   - chart    -> "Building chart", "3 of 5 points", counted off real rows.
 *   - document -> "Writing document", "84 of ~120 words", counted off real words.
 * Making each tab honest is also what stops all three looking like the same
 * animation played three times.
 *
 * Everything shown is REAL:
 *  - the image is genuinely MODUS output (public/made-by-modus.png, from
 *    gpt-image-1 via scripts/gen-marketing-image.ts, the same model and call the
 *    live /api/generate/image uses) and IMAGE_PROMPT below is the prompt that
 *    made it. Keep the two in sync or the caption becomes false.
 *  - the chart is a live recharts render, the same library ChartCard uses;
 *  - the document is rendered by markdownToHtml + .modus-doc — literally the
 *    same renderer DocumentCard uses, not a lookalike.
 *
 * Only add a tab for something chat emits TODAY (image | chart | document |
 * approval | options). Gamma-style decks and Cal AI logging are the unbuilt
 * modes plan; a tab here would be a promise.
 */

/** What a user types. The model expands this into the ```image block below. */
const IMAGE_ASK = 'Generate an image of a lone climber at dawn';

/**
 * The prompt MODUS actually sent to gpt-image-1, shown in the card header exactly
 * as ImageCard shows it in chat — which is what makes "from that prompt" true.
 * MUST stay byte-identical to PROMPT in scripts/gen-marketing-image.ts: that is
 * the prompt that produced public/made-by-modus.png.
 */
const IMAGE_GEN_PROMPT =
  'A lone climber on a dark granite ridge at dawn, seen from behind and far away, ' +
  'small against the mountain. Low violet and amber light raking across the rock, ' +
  'cold blue mist settling in the valley below, clean unbroken gradient sky. ' +
  'Shot on a 85mm lens, deep depth of field, natural light, photographic, ' +
  'fine grain, no text, no logos.';

const CHART_DATA: { label: string; Deep: number; Meetings: number }[] = [
  { label: 'Mon', Deep: 3.5, Meetings: 1.0 },
  { label: 'Tue', Deep: 2.0, Meetings: 3.5 },
  { label: 'Wed', Deep: 4.5, Meetings: 0.5 },
  { label: 'Thu', Deep: 1.5, Meetings: 4.0 },
  { label: 'Fri', Deep: 5.0, Meetings: 1.0 },
];

const DOC_TITLE = 'Q3-review.pdf';

// Longer than a stub on purpose: a document card holding two sentences showed
// nothing worth reading, so it read as a placeholder for a feature rather than
// the feature. This is what a real synthesis of a quarter's notes looks like.
const DOC_MD = `# Q3 Review

Revenue grew **34%** to $412k against flat headcount. Churn fell to **2.1%**, the lowest this year, and expansion covered all of it.

## What worked

- Self-serve onboarding shipped in week 3 and now carries **62%** of new signups.
- The pricing change lifted average contract value from $4.1k to $5.6k.
- Support first-response fell from 14h to under 3h after the triage rota.

## What didn't

- Enterprise onboarding still takes **9 days**. Three deals slipped past quarter end because of it.
- Outbound stalled at 40 touches a week against a target of 100.

## Q4 focus

1. Cut enterprise onboarding to 3 days.
2. Rebuild outbound around the two verticals that closed fastest.
3. Hold churn under 2.5% through the price increase.`;

const DOC_LINES = DOC_MD.split('\n');

/**
 * Word counts per line, mirroring countStreamedWords() in block-progress.ts —
 * which splits the raw markdown on whitespace, so "##" counts as a token there
 * and counts as one here too. Text is revealed a whole LINE at a time (partial
 * markdown would render "**34%" with the asterisks showing) while the number on
 * the bar counts words, which is what the real product counts.
 */
const DOC_LINE_WORDS = DOC_LINES.map(l => (l.trim() ? l.trim().split(/\s+/).length : 0));
const DOC_TOTAL_WORDS = DOC_LINE_WORDS.reduce((a, b) => a + b, 0);

type TabId = 'image' | 'chart' | 'doc';
type Stage = 'ask' | 'thinking' | 'building' | 'done';

interface TabDef {
  id: TabId;
  label: string;
  ask: string;
  /** A real chat model id where one applies (see lib/models.ts). */
  modelId: string;
  /**
   * gpt-image-1 is NOT in PLATFORM_MODELS — it isn't a selectable Brain. The
   * chat model emits a ```image block and /api/generate/image renders it on
   * gpt-image-1, so its provider is named here rather than looked up. The other
   * two resolve from the real catalog so a rename there flows through.
   */
  providerOverride?: string;
  /** The label lib/chat/block-progress.ts shows for this block type. */
  buildLabel: string;
  /** Units the real progress counts, or null where it stays indeterminate. */
  total: number | null;
  unitNoun: string;
  /** How long this tab holds the stage before handing to the next. */
  ms: number;
}

const TABS: TabDef[] = [
  { id: 'image', label: 'An image', ask: IMAGE_ASK, modelId: 'gpt-image-1', providerOverride: 'OpenAI', buildLabel: 'Creating image', total: null, unitNoun: '', ms: 6500 },
  { id: 'chart', label: 'A chart', ask: 'Chart my deep work vs meetings this week', modelId: 'claude-sonnet-4-6', buildLabel: 'Building chart', total: CHART_DATA.length, unitNoun: 'points', ms: 7000 },
  { id: 'doc', label: 'A document', ask: 'Turn my Q3 notes into a PDF I can send', modelId: 'claude-sonnet-4-6', buildLabel: 'Writing document', total: DOC_TOTAL_WORDS, unitNoun: 'words', ms: 7800 },
];

const STAGE_AT = { thinking: 350, building: 1050, done: 3300 } as const;
const BUILD_MS = STAGE_AT.done - STAGE_AT.building;

/** Name + provider for the routing chip, resolved from the real catalog where possible. */
function routedInfo(tab: TabDef): { name: string; provider: string } {
  const info = PLATFORM_MODELS.find(m => m.id === tab.modelId);
  return {
    // modelName() falls back to the id, which is right for gpt-image-1.
    name: modelName(tab.modelId),
    // Never name-match a logo with a silent fallback: a fuzzy lookup once put
    // Claude's mark on the ChatGPT column. ProviderLogo renders nothing for an
    // unknown provider, so a miss here is visible rather than wrong.
    provider: tab.providerOverride ?? info?.provider ?? '',
  };
}

function ModusAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mt-0.5">
      <Image src="/logo.png" alt="MODUS" width={14} height={14} className="opacity-75 dark:hidden" />
      <Image src="/logo-dark.png" alt="MODUS" width={14} height={14} className="opacity-75 hidden dark:block" />
    </div>
  );
}

/** The real "MODUS routed this to <model>" chip from MessageBubble. */
function RoutedChip({ tab }: { tab: TabDef }) {
  const { name, provider } = routedInfo(tab);
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-1.5 text-xs text-muted"
    >
      <span>MODUS routed this to</span>
      <motion.span
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26, delay: 0.05 }}
        className="inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-md border border-border bg-panel text-text font-medium"
      >
        <ProviderLogo provider={provider} className="w-3 h-3" />
        {name}
      </motion.span>
    </motion.div>
  );
}

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

/**
 * The real progress chrome from MessageBubble: a labelled bar that shows a
 * percentage ONLY when there is a declared total to count against, and a looping
 * sweep that promises nothing when there isn't.
 */
function BuildingBar({ label, detail, percent }: { label: string; detail: string; percent: number | null }) {
  return (
    <div className="px-4 py-3 border border-border bg-panel rounded-xl min-w-[240px]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
          {label}
          {detail && <span className="text-muted/60">· {detail}</span>}
        </span>
        {percent !== null && <span className="text-xs font-medium text-brand tabular-nums">{percent}%</span>}
      </div>
      <div className="h-1 w-full rounded-full bg-text/[0.08] overflow-hidden">
        {percent !== null ? (
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        ) : (
          <motion.div
            className="h-full w-1/3 rounded-full bg-brand/70"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
}

/** Card chrome shared by the three artifacts, mirroring the real cards' headers. */
function CardShell({ icon, title, titleClass = 'text-sm font-semibold text-text', subtitle, children, footer }: {
  icon: React.ReactNode;
  title: string;
  /** ImageCard shows the raw prompt in muted body text; the others show a title. */
  titleClass?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="border border-border rounded-2xl overflow-hidden bg-panel"
    >
      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <p className={`truncate flex-1 min-w-0 ${titleClass}`}>{title}</p>
        {subtitle && <span className="text-[11px] text-muted hidden sm:inline shrink-0">{subtitle}</span>}
      </div>
      {children}
      {footer && <div className="px-4 py-2.5 flex items-center gap-3 border-t border-border">{footer}</div>}
    </motion.div>
  );
}

const SparkleIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3Z" />
  </svg>
);

const ChartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v16a2 2 0 0 0 2 2h16M7 15l3.5-4 3 2.5L20 7" />
  </svg>
);

const DocIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-brand">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
  </svg>
);

function ImageStage({ stage }: { stage: Stage }) {
  const done = stage === 'done';
  return (
    <CardShell
      icon={SparkleIcon}
      // The expanded prompt, in the same muted truncated line ImageCard uses.
      title={IMAGE_GEN_PROMPT}
      titleClass="text-xs text-muted"
      subtitle="1536×1024"
      footer={done ? (
        <>
          <span className="text-xs font-semibold text-brand">Download</span>
          <span className="text-xs text-muted">Regenerate</span>
          <span className="text-[11px] text-muted/60 ml-auto hidden sm:inline">Actually made by MODUS, from that prompt. Not a stock photo.</span>
        </>
      ) : undefined}
    >
      {/* 3:2 because the source is 1536x1024 and lands here uncropped. A square
          source in a wide box had to be cropped and then upscaled past 1x on
          retina, which is what made this look soft. */}
      <div className="relative aspect-[3/2] bg-bg">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-brand/10 via-brand/[0.04] to-transparent"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 1.04, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Image
                src="/made-by-modus.png"
                alt="A lone climber on a dark granite ridge at dawn, generated by MODUS"
                fill
                sizes="(max-width: 1024px) 100vw, 960px"
                // 95, not the default 75: the dawn sky is a wide smooth gradient
                // and the default quantiser bands it into visible stripes.
                quality={95}
                priority
                className="object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CardShell>
  );
}

function ChartStage({ points }: { points: number }) {
  // The x-axis keeps every label and the y domain is fixed, so the line extends
  // left to right as rows land instead of the whole chart rescaling each time.
  const data = useMemo(
    () => CHART_DATA.map((d, i) => (i < points ? d : { label: d.label, Deep: null, Meetings: null })),
    [points],
  );
  return (
    <CardShell icon={ChartIcon} title="Deep work vs meetings" subtitle="hours">
      <div className="p-4">
        <div className="flex items-center justify-end gap-3 mb-2">
          <span className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-4 h-0.5 rounded-full bg-[#7C3AED]" /> Deep work
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-4 border-t-2 border-dashed border-[#a78bfa]" /> Meetings
          </span>
        </div>
        {/* Taller on desktop so the chart doesn't leave a dead gap under it next
            to the (much taller) image tab in a fixed-height stage. */}
        <div className="h-[240px] sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              {/* Theme vars, not hardcoded darks — same as the real ChartCard, so
                  this doesn't invert into an invisible chart in light mode. */}
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--color-muted))' }} axisLine={false} tickLine={false} />
              <YAxis width={28} domain={[0, 6]} tick={{ fontSize: 11, fill: 'rgb(var(--color-muted))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--color-panel))',
                  border: '1px solid rgb(var(--color-border))',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'rgb(var(--color-text))',
                }}
              />
              {/* Animation off: the line growing a point at a time IS the motion,
                  and recharts otherwise redraws the whole series on every append. */}
              <Line type="monotone" dataKey="Deep" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Meetings" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted/70 mt-2">A live chart, not a screenshot. Same renderer you get in chat.</p>
      </div>
    </CardShell>
  );
}

function DocStage({ words }: { words: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Whole lines only — a half-written "**34%" would render its asterisks. The
  // bar still counts words, because words are what the real product counts.
  const linesShown = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < DOC_LINES.length; i++) {
      acc += DOC_LINE_WORDS[i];
      if (acc > words) return i;
    }
    return DOC_LINES.length;
  }, [words]);

  const html = useMemo(
    () => markdownToHtml(DOC_LINES.slice(0, linesShown).join('\n')),
    [linesShown],
  );
  const complete = linesShown >= DOC_LINES.length;

  // Follow the cursor while it writes, then present the finished document from
  // the top — which is the view the real DocumentCard gives you. Without this
  // the text would grow past the box and appear to stall halfway through, while
  // the word counter kept ticking.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = complete ? 0 : el.scrollHeight;
  }, [linesShown, complete]);

  return (
    <CardShell
      icon={DocIcon}
      title={DOC_TITLE}
      subtitle="Edit it before it goes out"
      footer={complete ? (
        <>
          <span className="text-xs font-semibold text-brand">Edit</span>
          <span className="text-xs text-muted">Download PDF</span>
          <span className="text-xs text-muted">Copy text</span>
        </>
      ) : undefined}
    >
      {/* markdownToHtml + .modus-doc is literally what DocumentCard renders with,
          so this is the real renderer rather than a lookalike. The markdown is a
          constant in this file and markdownToHtml escapes its input.

          Fixed height, capped with a fade and an "Open document" hint — exactly
          how DocumentCard renders a long doc inline (max-h-72 + fade). It also
          pins this tab's height: unbounded, the finished Q3 review ran 1607px on
          a phone against the image tab's 1022px, so every hand-off shoved the
          rest of the page up or down by ~585px. */}
      <div className="relative h-[300px] sm:h-[420px]">
        <div ref={scrollRef} className="h-full overflow-hidden">
          <div className="modus-doc px-5 py-4" dangerouslySetInnerHTML={{ __html: html }} />
          {!complete && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="inline-block w-1.5 h-3.5 bg-brand align-middle ml-5"
            />
          )}
        </div>
        {/* Taller and held opaque longer than the real card's fade: the label sits
            at bottom-2, and a plain from-panel gradient is only ~90% there by that
            point, so the clipped line stayed legible UNDER the words "Open
            document". via-panel makes the bottom third solid before the label. */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-panel via-panel to-transparent pointer-events-none" />
        {complete && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-muted">Open document</span>
        )}
      </div>
    </CardShell>
  );
}

export default function CreationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-120px 0px' });
  const [tab, setTab] = useState<TabId>('image');
  const [stage, setStage] = useState<Stage>('ask');
  const [progress, setProgress] = useState(0); // 0..1 through the building stage
  const [paused, setPaused] = useState(false);
  // Bumped when the section re-enters view, so the CSS tab bar remounts and
  // restarts alongside the JS clock instead of carrying on from off-screen.
  const [runId, setRunId] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = TABS.find(t => t.id === tab)!;
  const runKey = `${tab}-${runId}`;

  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  useEffect(() => { if (inView) setRunId(r => r + 1); }, [inView]);

  // Stages and hand-off are SEPARATE on purpose. Hovering pauses the hand-off
  // only; if it also drove the stages, pausing to look at the image would
  // restart the whole performance in your face, which is the opposite of what
  // hovering means. Nothing here depends on `paused`.
  useEffect(() => {
    if (!inView) { clear(); return; }
    setStage('ask');
    setProgress(0);
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(STAGE_AT.thinking, () => setStage('thinking'));
    at(STAGE_AT.building, () => setStage('building'));
    at(STAGE_AT.done, () => { setStage('done'); setProgress(1); });
    return clear;
  }, [tab, inView, clear]);

  // Drives the unit count while building, so the number on the bar and the thing
  // being built are the same clock.
  useEffect(() => {
    if (stage !== 'building') return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / BUILD_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, tab]);

  usePausableTimeout(
    () => setTab(TABS[(TABS.findIndex(t => t.id === tab) + 1) % TABS.length].id),
    active.ms,
    paused || !inView,
    runKey,
  );

  const built = stage === 'done' ? 1 : progress;
  const units = active.total !== null ? Math.round(built * active.total) : 0;
  // Capped at 99 while streaming, exactly as pct() does in block-progress.ts:
  // 100% must mean rendered, not "last row seen". Stays indeterminate until the
  // first unit actually lands, because that is what blockProgress does — it only
  // returns a percent once `total && done > 0`, and sweeps until then.
  const percent = active.total !== null && stage === 'building' && units > 0
    ? Math.max(1, Math.min(99, Math.round(built * 100)))
    : null;
  // Phrased exactly as block-progress.ts phrases it, including the "~" that only
  // the word count carries (the model estimates words; chart points are exact).
  const detail = active.total !== null && units > 0
    ? `${units} of ${active.id === 'doc' ? '~' : ''}${active.total} ${active.unitNoun}`
    : '';

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
                    {/* A CSS animation, not framer, because this bar has to FREEZE
                        where it is on hover. animation-play-state does that
                        exactly; a framer `animate` can only be given a new target,
                        so pausing made it jump to 100% and lie about time left.
                        Keyed on runKey so it restarts with the JS clock. */}
                    <span
                      key={runKey}
                      className="absolute inset-y-0 left-0 bg-brand tab-fill"
                      style={{ animationDuration: `${t.ms}ms`, animationPlayState: paused || !inView ? 'paused' : 'running' }}
                    />
                  </>
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-panel/60 rounded-2xl p-4 ring-1 ring-border shadow-2xl shadow-black/20">
          {/* The ask — the real chat's user bubble */}
          <div className="flex justify-end mb-3">
            <motion.div
              key={`${tab}-ask`}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[72%]"
            >
              <p className="text-sm leading-relaxed">{active.ask}</p>
            </motion.div>
          </div>

          <div className="flex justify-start gap-2.5">
            <ModusAvatar />
            {/* Capped rather than full-bleed: at the panel's full width a 3:2
                image runs ~590px tall and swallows the section, and the document
                becomes an unreadable wall. The real cards are narrower still
                (ImageCard max-w-sm, DocumentCard max-w-md) — this is the widest
                that still reads as a chat answer rather than a hero banner. */}
            <div className="min-w-0 flex-1 max-w-2xl space-y-3">
              <AnimatePresence mode="wait">
                {stage !== 'ask' && <RoutedChip key={`${tab}-routed`} tab={active} />}
              </AnimatePresence>

              {/* Sized to the TALLEST tab at each breakpoint so a hand-off never
                  resizes the section under the reader. Measured, not guessed —
                  see the jump numbers in the DocStage note. */}
              <div className="min-h-[420px] sm:min-h-[560px]">
                <AnimatePresence mode="wait">
                  {stage === 'ask' || stage === 'thinking' ? (
                    <motion.div key="think" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5 py-4">
                      <Dots />
                    </motion.div>
                  ) : (
                    <motion.div key={`work-${tab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
                      <AnimatePresence>
                        {stage === 'building' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <BuildingBar label={active.buildLabel} detail={detail} percent={percent} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {tab === 'image' ? (
                        <ImageStage stage={stage} />
                      ) : tab === 'chart' ? (
                        <ChartStage points={units} />
                      ) : (
                        <DocStage words={units} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
