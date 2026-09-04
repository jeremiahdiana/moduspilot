/**
 * The 5-hour rolling usage window, as executable checks.
 *
 * The short chat ceiling stopped being a UTC calendar day (tokenDate/dailyTokens)
 * and became a rolling window anchored at windowStart, WINDOW_MS wide
 * (lib/chat/limits.ts, lib/constants.ts). Every assertion here is a boundary the
 * gate and the meter must agree on, on the TIME axis rather than the quantity
 * axis that verify-limit-addon.ts already covers:
 *
 *   - an expired window (or a doc that never had one) counts as 0
 *   - a live window blocks exactly at the ceiling, and the meter reads 100 only then
 *   - the weekly cap still bites independently, even inside a brand-new window
 *
 *   cd apps/web && npx tsx scripts/verify-window.ts
 */
import { planCeilings } from '../lib/plan';
import { WINDOW_MS } from '../lib/constants';
import { enforcePaidTokenLimit, usagePercent, getWeekKey } from '../lib/chat/limits';

let failed = false;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed = true;
}
function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

const now = Date.now();
const weekKey = getWeekKey();
const WINDOW = planCeilings({ plan: 'modus' }).window; // 750,000
const WEEKLY = planCeilings({ plan: 'modus' }).weekly; // 3,500,000

/** A paid user doc with a given window age + spend, and a clean week. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function doc(over: Record<string, any> = {}) {
  return { plan: 'modus', windowStart: now, windowTokens: 0, tokenWeek: weekKey, weeklyTokens: 0, ...over };
}
const blocked = (d: object) => enforcePaidTokenLimit(d as never)?.status === 429;

// ── 1. A live window blocks exactly at the ceiling ──────────────────────────
section('live window boundary');
check('one unit under the ceiling is allowed', !blocked(doc({ windowTokens: WINDOW - 1 })));
check('…and the meter agrees it is under 100%', (usagePercent(doc({ windowTokens: WINDOW - 1 })) ?? 0) < 100);
check('at the ceiling is blocked', blocked(doc({ windowTokens: WINDOW })));
check('…and the meter reads exactly 100%', usagePercent(doc({ windowTokens: WINDOW })) === 100);

// ── 2. An expired window counts as zero ─────────────────────────────────────
section('window expiry');
// windowStart older than WINDOW_MS: even a wildly-over count must not gate.
check('a 6h-old window is expired → not blocked', !blocked(doc({ windowStart: now - 6 * 3600_000, windowTokens: WINDOW * 100 })));
check('…and the meter shows 0% for the expired window', usagePercent(doc({ windowStart: now - 6 * 3600_000, windowTokens: WINDOW * 100 })) === 0);
// A window still inside WINDOW_MS keeps counting.
check('a 4h-old window is still live → blocked at the ceiling', blocked(doc({ windowStart: now - 4 * 3600_000, windowTokens: WINDOW })));
// Right at the edge: WINDOW_MS ago is expired (now < start + WINDOW_MS is false).
check('exactly WINDOW_MS old is expired', !blocked(doc({ windowStart: now - WINDOW_MS, windowTokens: WINDOW * 100 })));

// ── 3. Missing window fields self-heal (migration off the calendar day) ─────
section('legacy / missing fields');
check('no windowStart at all → treated as expired, not blocked', !blocked({ plan: 'modus', windowTokens: WINDOW * 100, tokenWeek: weekKey, weeklyTokens: 0 } as never));
check('an old calendar-day doc (dailyTokens only) does not gate', !blocked({ plan: 'modus', dailyTokens: WINDOW * 100, tokenDate: '2020-01-01', tokenWeek: weekKey, weeklyTokens: 0 } as never));

// ── 4. The weekly cap bites independently, even in a fresh window ────────────
section('weekly still governs');
check('weekly at ceiling blocks despite an empty live window', blocked(doc({ windowTokens: 0, weeklyTokens: WEEKLY })));
check('a stale week key resets the weekly count', !blocked(doc({ windowTokens: 0, tokenWeek: 'not-this-week', weeklyTokens: WEEKLY * 100 })));
check('the meter takes the higher of window and week', usagePercent(doc({ windowTokens: 0, weeklyTokens: WEEKLY })) === 100);

// ── 5. Free plans are never gated by this ceiling ───────────────────────────
section('free plan is out of scope');
check('a free doc over every ceiling is still ungated', !blocked({ plan: 'free', windowStart: now, windowTokens: WINDOW * 100, tokenWeek: weekKey, weeklyTokens: WEEKLY * 100 } as never));
check('…and reports no percentage', usagePercent({ plan: 'free', windowStart: now, windowTokens: WINDOW } as never) === null);

console.log(
  failed
    ? '\n❌ FAILED — the rolling window gate and meter disagree.\n'
    : '\n✅ The 5-hour rolling window holds at every boundary.\n',
);
process.exit(failed ? 1 : 0);
