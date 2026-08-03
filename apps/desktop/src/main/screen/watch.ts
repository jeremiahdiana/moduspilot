import { desktopCapturer, screen } from 'electron';
import log from 'electron-log';

/**
 * Watch mode — MODUS looking at the screen on a timer instead of on a hotkey.
 *
 * 🚨 THIS IS THE EXPENSIVE MODE AND IT IS OFF BY DEFAULT. Every trigger is a
 * full-resolution image billed as input tokens against the user's plan ceiling
 * (enforcePaidTokenLimit). A naive "capture every 5 seconds and ask" is 720
 * vision calls an hour on a screen that mostly is not changing, which would burn
 * a customer's entire allowance while they read one document.
 *
 * So two independent brakes, and both are load-bearing:
 *
 *   1. A DIFF. Each tick grabs a deliberately tiny thumbnail and compares block
 *      brightness against the last one. Unchanged screen ⇒ no model call at all.
 *      The tick costs a compositor grab and some arithmetic, not money.
 *   2. A CEILING. Even on a screen that never stops moving (a video, a terminal
 *      tailing logs, a blinking cursor) there is a hard cap on calls per hour and
 *      a minimum gap between them. The diff alone is not enough: it is a
 *      heuristic, and a heuristic cannot be trusted with someone's bill.
 */

/** Tiny on purpose — this is a change detector, not a screenshot. */
const PROBE_W = 96;
const PROBE_H = 60;
/**
 * Grid the probe is reduced to before comparing.
 *
 * 🪤 THIS WAS 8x5 AND IT WAS BLIND TO SCROLLING. Block MEAN brightness does not
 * change when content shifts by less than a block, so a page scrolling inside
 * 12-pixel-tall blocks registered as "nothing happened" — measured at delta
 * 0.0000 for a half-block shift, i.e. watch mode would sit silent through the
 * single most common thing a screen does. Swept 2026-08-03 across probe and grid
 * sizes; 16x10 is where scroll separates from noise:
 *
 *   grid    cursor blink   text scroll   stripe scroll   window switch
 *   8x5       0.0021         0.0701        0.0000          0.4585
 *   16x10     0.0021         0.0854        0.5752          0.4585
 *
 * The cursor-blink figure is what stops a finer grid from being free: go much
 * finer and idle noise starts approaching the threshold, and every false trigger
 * is a billed vision call.
 */
const BLOCKS_X = 16;
const BLOCKS_Y = 10;

/**
 * How different two frames must be to count as "something happened", 0–1.
 *
 * Tuned to ignore a blinking text cursor and antialiasing jitter while catching a
 * scroll, a window switch or a new dialog. Too low and the ceiling below becomes
 * the only brake, which defeats the point of having a diff.
 */
const CHANGE_THRESHOLD = 0.045;  // measured margin: ~0.002 idle vs ~0.085 scroll

/**
 * Brakes. Deliberately conservative — this runs unattended on someone's card.
 *
 * 📉 TIGHTENED after measuring on a real desktop (2026-08-03). A working machine
 * is never actually still: a terminal printing output, a clock, an incoming
 * notification, a video thumbnail. The diff correctly reports all of those as
 * change, so on an ordinary screen watch mode does not gently sip its allowance —
 * it pins itself to the ceiling and spends it. At 20/hour with a 15s floor that is
 * 20 full-resolution vision calls an hour, every hour the toggle is left on.
 *
 * 🚨 AND THEN THAT REASONING WAS STILL WRONG, because it was about INTERRUPTION
 * FREQUENCY and never about money. Measured on a real account: one watch look on
 * Claude Sonnet 5 with the full context is ~126,000 budget units against a
 * 500,000/day MODUS ceiling. Twelve an hour emptied a customer's entire day in
 * twenty minutes. A cap counted in TRIGGERS is meaningless when the cost of a
 * trigger varies 27x by model — the real brake is settings.ts's persisted daily
 * look budget, plus forcing watch onto a 1x-weight model. These two numbers are
 * now the secondary defence, not the only one.
 */
const MAX_TRIGGERS_PER_HOUR = 6;
const MIN_GAP_MS = 60_000;

/**
 * Mean brightness per block, from a BGRA bitmap.
 *
 * Kept as a free function taking raw bytes (rather than a NativeImage) so the
 * change detection can be tested without launching Electron — which is the only
 * way this logic ever gets exercised against known inputs.
 */
export function signature(bitmapBGRA: Buffer, width: number, height: number): Float64Array {
  const out = new Float64Array(BLOCKS_X * BLOCKS_Y);
  const counts = new Uint32Array(BLOCKS_X * BLOCKS_Y);
  if (width <= 0 || height <= 0) return out;
  for (let y = 0; y < height; y++) {
    const by = Math.min(BLOCKS_Y - 1, Math.floor((y * BLOCKS_Y) / height));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (i + 2 >= bitmapBGRA.length) continue;
      // Rec. 601 luma off BGRA. Colour is irrelevant here; brightness structure
      // is what distinguishes "scrolled" from "same page".
      const luma = 0.114 * bitmapBGRA[i] + 0.587 * bitmapBGRA[i + 1] + 0.299 * bitmapBGRA[i + 2];
      const bx = Math.min(BLOCKS_X - 1, Math.floor((x * BLOCKS_X) / width));
      const b = by * BLOCKS_X + bx;
      out[b] += luma;
      counts[b]++;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = counts[i] ? out[i] / counts[i] / 255 : 0;
  return out;
}

/** Mean absolute difference of two signatures, 0–1. */
export function difference(a: Float64Array, b: Float64Array): number {
  if (a.length === 0 || a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/**
 * The spend brake. `now` is injectable so its behaviour over an hour can be
 * tested in milliseconds instead of waiting an hour to find out it is wrong.
 */
export class TriggerCeiling {
  private readonly stamps: number[] = [];
  constructor(
    private readonly maxPerHour = MAX_TRIGGERS_PER_HOUR,
    private readonly minGapMs = MIN_GAP_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Why a trigger was refused, or null when it is allowed. */
  check(): 'too-soon' | 'hourly-cap' | null {
    const t = this.now();
    while (this.stamps.length > 0 && t - this.stamps[0] > 3_600_000) this.stamps.shift();
    if (this.stamps.length > 0 && t - this.stamps[this.stamps.length - 1] < this.minGapMs) return 'too-soon';
    if (this.stamps.length >= this.maxPerHour) return 'hourly-cap';
    return null;
  }

  record(): void { this.stamps.push(this.now()); }
  reset(): void { this.stamps.length = 0; }
}

/**
 * One reading of the screen, exposed so the capture+diff pipeline can be tested
 * against a REAL screen change rather than only against synthetic bitmaps.
 *
 * Without this, the only observable behaviour is "did onChange fire", which is
 * gated by the spend ceiling — so a test short enough to run is guaranteed to be
 * refused by the 30s floor, and would report a working detector as broken.
 */
export async function probeSignature(): Promise<Float64Array | null> {
  const p = await probe();
  return p ? p.sig : null;
}

async function probe(): Promise<{ sig: Float64Array } | null> {
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: PROBE_W, height: PROBE_H },
      fetchWindowIcons: false,
    });
    if (sources.length === 0) return null;
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
    const img = source.thumbnail;
    if (img.isEmpty()) return null;
    const size = img.getSize();
    return { sig: signature(img.toBitmap(), size.width, size.height) };
  } catch (err) {
    log.error('[watch] probe failed', err);
    return null;
  }
}

let timer: NodeJS.Timeout | null = null;
let last: Float64Array | null = null;
let ceiling = new TriggerCeiling();
let inFlight = false;

export function isWatching(): boolean { return timer !== null; }

/**
 * Start watching. `onChange` is only called when the screen actually changed AND
 * the ceiling allows it.
 *
 * `onChange` is awaited and re-entry is blocked: without that, a model call
 * slower than the tick interval would stack requests on top of each other and
 * every brake above would be irrelevant.
 */
export function startWatch(
  intervalMs: number,
  onChange: () => Promise<void>,
  /** Test seam: lets a verification script exercise triggering without waiting out the 30s floor. */
  ceilingOverride?: TriggerCeiling,
): void {
  stopWatch();
  last = null;
  ceiling = ceilingOverride ?? new TriggerCeiling();
  log.info(`[watch] started (every ${intervalMs}ms, max ${MAX_TRIGGERS_PER_HOUR}/hour)`);

  timer = setInterval(() => {
    if (inFlight) return;
    void (async () => {
      const p = await probe();
      if (!p) return;
      const previous = last;
      last = p.sig;
      if (!previous) return; // first tick establishes a baseline, never fires

      const delta = difference(previous, p.sig);
      if (delta < CHANGE_THRESHOLD) return;

      const refused = ceiling.check();
      if (refused) {
        log.info(`[watch] change ${delta.toFixed(3)} ignored (${refused})`);
        return;
      }

      ceiling.record();
      inFlight = true;
      try {
        await onChange();
      } catch (err) {
        log.error('[watch] onChange failed', err);
      } finally {
        inFlight = false;
      }
    })();
  }, intervalMs);
}

export function stopWatch(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info('[watch] stopped');
  }
  last = null;
  inFlight = false;
}
