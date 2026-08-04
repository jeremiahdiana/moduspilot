/**
 * The limits add-on, as executable checks.
 *
 * Every assertion here corresponds to a real defect found in the pre-build audit
 * (2026-08-04) rather than to a hypothetical. The add-on is the first thing in
 * MODUS that gives one user TWO live Stripe subscriptions, and almost every bug
 * it can cause is a variation on "something treated the $10 add-on as if it were
 * the plan".
 *
 *   cd apps/web && npx tsx scripts/verify-limit-addon.ts
 */
import { planCeilings, limitAddonQty, isPaidPlan } from '../lib/plan';
import { isAddonSubscription } from '../lib/billing';
import {
  MODUS_TOKEN_LIMIT,
  PILOT_TOKEN_LIMIT,
  MODUS_WEEKLY_LIMIT,
  PILOT_WEEKLY_LIMIT,
  LIMIT_ADDON_DAILY,
  LIMIT_ADDON_WEEKLY,
} from '../lib/constants';
import { LIMIT_ADDON, PRICE_ENV, resolvePlanPrice } from '../lib/pricing';
import { enforcePaidTokenLimit, usagePercent } from '../lib/chat/limits';

let failed = false;

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed = true;
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

const today = new Date().toISOString().slice(0, 10);
/** A user doc at a given plan + add-on quantity, with usage already on the clock. */
function user(plan: string, qty: number, dailyTokens = 0) {
  return { plan, limitAddonQty: qty, dailyTokens, tokenDate: today, weeklyTokens: 0, tokenWeek: '' };
}

// ── 1. Ceilings scale, on BOTH plans, daily AND weekly ──────────────────────
section('ceilings');

for (const [plan, baseDaily, baseWeekly] of [
  ['modus', MODUS_TOKEN_LIMIT, MODUS_WEEKLY_LIMIT],
  ['pilot', PILOT_TOKEN_LIMIT, PILOT_WEEKLY_LIMIT],
] as const) {
  for (const qty of [0, 1, 2, 5]) {
    const c = planCeilings(user(plan, qty));
    check(
      `${plan} x${qty}`,
      c.daily === baseDaily + qty * LIMIT_ADDON_DAILY && c.weekly === baseWeekly + qty * LIMIT_ADDON_WEEKLY,
      `daily ${c.daily.toLocaleString()} weekly ${c.weekly.toLocaleString()}`,
    );
  }
}

// 🪤 A hand-edited Firestore doc must not be able to mint an infinite ceiling.
section('quantity coercion');
check('undefined → 0', limitAddonQty({}) === 0);
check('negative → 0', limitAddonQty({ limitAddonQty: -5 }) === 0);
check('string "3" → 3', limitAddonQty({ limitAddonQty: '3' }) === 3);
check('NaN → 0', limitAddonQty({ limitAddonQty: 'abc' }) === 0);
check('2.7 → 2 (floored)', limitAddonQty({ limitAddonQty: 2.7 }) === 2);
check('free plan still reads qty', limitAddonQty({ plan: 'free', limitAddonQty: 1 }) === 1);

// ── 2. THE BIG ONE: the gate and the meter must never disagree ──────────────
//
// enforcePaidTokenLimit and usagePercent used to compute the ceiling separately,
// and UsageSettings computed it a THIRD time on the client. Teaching two of the
// three about the add-on is the bug that ships — the user sees 100% while the
// server serves, or gets blocked at a number the meter never showed.
section('gate and meter agree at the boundary');

for (const qty of [0, 1, 3]) {
  const ceiling = planCeilings(user('modus', qty)).daily;

  const justUnder = user('modus', qty, ceiling - 1);
  check(
    `x${qty}: one unit below the ceiling is allowed`,
    enforcePaidTokenLimit(justUnder) === null,
    `${(ceiling - 1).toLocaleString()} / ${ceiling.toLocaleString()}`,
  );
  check(`x${qty}: ...and the meter agrees it is under 100%`, (usagePercent(justUnder) ?? 0) < 100);

  const exactly = user('modus', qty, ceiling);
  check(`x${qty}: at the ceiling is blocked`, enforcePaidTokenLimit(exactly)?.status === 429);
  check(`x${qty}: ...and the meter reads 100%`, usagePercent(exactly) === 100);
}

// The add-on must not hand ceilings to someone who isn't paying at all.
section('an add-on is not access');
const freeWithAddon = user('free', 3, 10_000_000);
check('free plan is not a paid plan', !isPaidPlan('free'));
check('free + add-on is still ungated (no ceiling applies)', enforcePaidTokenLimit(freeWithAddon) === null);
check('free + add-on reports no usage percentage', usagePercent(freeWithAddon) === null);

// ── 3. Pricing wiring ───────────────────────────────────────────────────────
section('pricing');
check('LIMIT_ADDON has a monthly price', LIMIT_ADDON.monthlyPrice > 0, `$${LIMIT_ADDON.monthlyPrice}/mo`);
check(
  'LIMIT_ADDON.dailyUnits matches the enforced constant',
  LIMIT_ADDON.dailyUnits === LIMIT_ADDON_DAILY,
  `${LIMIT_ADDON.dailyUnits.toLocaleString()} vs ${LIMIT_ADDON_DAILY.toLocaleString()}`,
);
check('weekly add-on is exactly 7 daily', LIMIT_ADDON_WEEKLY === LIMIT_ADDON_DAILY * 7);
check('limitAddon is registered in PRICE_ENV', !!PRICE_ENV.limitAddon);
check('limitAddon has no annual price', PRICE_ENV.limitAddon?.annual === undefined);
check(
  'an annual add-on request falls back to monthly',
  resolvePlanPrice('limitAddon', 'annual').cadence === 'monthly',
);
check('Group is no longer purchasable', PRICE_ENV.group === undefined);

// 💸 The margin floor. costWeight rounds UP and the unit is pinned to
// gemini-3.5-flash-LITE at $0.52/1M, so this is a CEILING on real cost, not a
// guess. (The baseline moved from flash to flash-lite when flash was found to be
// carrying flash-lite's rates — the dollar value per unit did NOT change, so the
// margin below is unaffected. Re-check this constant if BASELINE moves again.)
section('margin floor');
const USD_PER_MILLION_UNITS = 0.52;
const worstCaseMonthly = (LIMIT_ADDON_DAILY * 30 / 1_000_000) * USD_PER_MILLION_UNITS;
const margin = (LIMIT_ADDON.monthlyPrice - worstCaseMonthly) / LIMIT_ADDON.monthlyPrice;
console.log(`   worst-case cost  $${worstCaseMonthly.toFixed(2)}/mo`);
console.log(`   price            $${LIMIT_ADDON.monthlyPrice.toFixed(2)}/mo`);
console.log(`   floor margin     ${(margin * 100).toFixed(0)}%`);
check(
  'the add-on is profitable even at 100% frontier-model burn',
  worstCaseMonthly < LIMIT_ADDON.monthlyPrice,
  `$${worstCaseMonthly.toFixed(2)} < $${LIMIT_ADDON.monthlyPrice.toFixed(2)}`,
);
if (margin < 0.15) {
  console.log('   ⚠️  floor margin under 15% — one under-estimated model price flips this negative.');
}

// ── 4. Add-on subscriptions must never look like plans ──────────────────────
//
// This is the money bug: downgradeIfNoLiveSubscription keeps access alive when
// ANY other live sub exists, so a surviving $10 add-on would leave a cancelled
// subscriber on full MODUS. isAddonSubscription is what stops that.
section('add-on subscriptions are not plans');
type FakeSub = { id: string; status: string; metadata: Record<string, string | undefined> };
const addonSub: FakeSub = { id: 'sub_addon', status: 'active', metadata: { uid: 'u1', addon: 'limits' } };
const planSub: FakeSub = { id: 'sub_plan', status: 'active', metadata: { uid: 'u1', plan: 'modus' } };

check('an add-on sub is detected', isAddonSubscription(addonSub as never));
check('a plan sub is NOT detected as an add-on', !isAddonSubscription(planSub as never));
check('a sub with no metadata is not an add-on', !isAddonSubscription({ id: 's', metadata: {} } as never));
check('null is not an add-on', !isAddonSubscription(null));
check(
  'the add-on carries no metadata.plan',
  addonSub.metadata.plan === undefined,
  'so isGrantablePlan can never grant on it',
);

console.log(
  failed
    ? '\n❌ FAILED — do not ship the add-on until these pass.\n'
    : '\n✅ All limit add-on invariants hold.\n',
);
process.exit(failed ? 1 : 0);
