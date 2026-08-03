/**
 * Do watch mode's two brakes actually hold?
 *
 * Watch mode captures the screen on a timer and asks a vision model about it.
 * The ONLY things standing between that and a customer's entire token allowance
 * are the frame diff and the trigger ceiling. Both are pure functions on purpose
 * so they can be tested against known inputs here, in milliseconds, instead of
 * being "verified" by staring at a running app for an hour.
 *
 * A brake you have never watched engage is not a brake.
 *
 *   cd apps/desktop && npx tsx scripts/verify-watch-diff.ts
 */
import { signature, difference, TriggerCeiling } from '../src/main/screen/watch';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** A BGRA bitmap, the layout NativeImage.toBitmap() returns. */
function bitmap(width: number, height: number, at: (x: number, y: number) => [number, number, number]): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = at(x, y);
      const i = (y * width + x) * 4;
      buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255;
    }
  }
  return buf;
}

const W = 96, H = 60;
const THRESHOLD = 0.045; // must match CHANGE_THRESHOLD in watch.ts

console.log('\nFrame diff\n');

const plain = bitmap(W, H, () => [255, 255, 255]);
const sigPlain = signature(plain, W, H);

{
  // The case that matters most for cost: a still screen must cost nothing.
  const d = difference(sigPlain, signature(bitmap(W, H, () => [255, 255, 255]), W, H));
  check('identical frames do not trigger', d < THRESHOLD, `delta=${d.toFixed(4)}`);
}

{
  // A blinking text cursor: a couple of dark pixels flipping. If this triggers,
  // watch mode bills a vision call every few seconds at an idle editor.
  const cursor = bitmap(W, H, (x, y) => (x >= 10 && x < 12 && y >= 18 && y < 24 ? [0, 0, 0] : [255, 255, 255]));
  const d = difference(sigPlain, signature(cursor, W, H));
  check('a blinking cursor does not trigger', d < THRESHOLD, `delta=${d.toFixed(4)}`);
}

{
  // Window switch / new dialog: half the screen changes.
  const half = bitmap(W, H, (x) => (x < W / 2 ? [20, 20, 30] : [255, 255, 255]));
  const d = difference(sigPlain, signature(half, W, H));
  check('a window switch triggers', d >= THRESHOLD, `delta=${d.toFixed(4)}`);
}

{
  // Scrolling: content shifts vertically. Block brightness moves with it.
  // Two shapes of scroll, because they fail differently.
  // (a) Periodic stripes shifted by half a period: the ADVERSARIAL case. Every
  //     block keeps its mean brightness, so a coarse grid scores it 0.0000 — this
  //     is the exact input that caught the 8x5 grid being blind to scrolling.
  const period = 12;
  const before = bitmap(W, H, (_x, y) => (y % period < 5 ? [30, 30, 30] : [250, 250, 250]));
  const after = bitmap(W, H, (_x, y) => ((y + period / 2) % period < 5 ? [30, 30, 30] : [250, 250, 250]));
  const d = difference(signature(before, W, H), signature(after, W, H));
  check('scrolling triggers (periodic content)', d >= THRESHOLD, `delta=${d.toFixed(4)}`);

  // (b) Irregular text-like content scrolled by 3px: the ORDINARY case.
  const text = (offset: number) => bitmap(W, H, (x, y) => {
    const line = Math.floor((y + offset) / 3);
    const inked = ((line * 2654435761) >>> 0) % 5 < 2 && ((x * 2246822519 + line * 3266489917) >>> 0) % 7 < 4;
    return inked ? [40, 40, 40] : [248, 248, 248];
  });
  const dt = difference(signature(text(0), W, H), signature(text(3), W, H));
  check('scrolling triggers (text-like content)', dt >= THRESHOLD, `delta=${dt.toFixed(4)}`);
}

{
  const black = bitmap(W, H, () => [0, 0, 0]);
  const d = difference(sigPlain, signature(black, W, H));
  check('white → black is a large delta', d > 0.9, `delta=${d.toFixed(4)}`);
}

{
  // Degenerate input must not read as "no change" — a zero-size grab returning
  // 0 would silently mean "screen is identical" and stall watch mode forever.
  const d = difference(new Float64Array(0), new Float64Array(0));
  check('empty signatures report maximum difference', d === 1, `delta=${d}`);
}

console.log('\nTrigger ceiling\n');

{
  let now = 0;
  const c = new TriggerCeiling(12, 30_000, () => now);
  check('first trigger is allowed', c.check() === null);
  c.record();
  now += 1_000;
  check('1s later is refused (min gap)', c.check() === 'too-soon');
  now += 35_000;
  check('36s later is allowed', c.check() === null);
}

{
  // The brake that matters on a screen that never stops moving: a video, or a
  // terminal tailing logs. The diff will fire every single tick; only this stops it.
  let now = 0;
  const c = new TriggerCeiling(12, 30_000, () => now);
  let allowed = 0;
  for (let i = 0; i < 500; i++) {
    if (c.check() === null) { c.record(); allowed++; }
    now += 5_000; // a 5s tick, i.e. the default watch interval
  }
  // 500 ticks x 5s = ~41 minutes of constant motion.
  check('constant motion cannot exceed the hourly cap', allowed <= 12, `${allowed} triggers in ~41 minutes of nonstop change`);
  check('but it is not stuck at zero either', allowed > 0, `${allowed} triggers`);
}

{
  let now = 0;
  const c = new TriggerCeiling(12, 30_000, () => now);
  for (let i = 0; i < 12; i++) { c.record(); now += 31_000; }
  check('cap reached is reported as hourly-cap', c.check() === 'hourly-cap');
  now += 3_600_001; // the window rolls
  check('the window rolls forward', c.check() === null);
}

console.log(`\n${failures === 0 ? '✅ PASS' : `❌ ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
