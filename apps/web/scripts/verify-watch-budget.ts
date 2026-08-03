/**
 * Can watch mode empty a customer's daily allowance?
 *
 * 🚨 THIS IS THE CHECK THAT WAS MISSING, AND ITS ABSENCE COST A REAL DAY'S BUDGET
 * TWICE IN ONE EVENING. Watch mode's cap was set to "12 an hour" by reasoning
 * about how often an assistant should interrupt someone. Nobody costed a single
 * look against the ceiling it spends from. Measured afterwards, on a real account:
 *
 *   one look, Claude Sonnet 5 (a saved Brain of `auto` routes there), full
 *   life-OS context, two 1400px frames  ≈ 126,000 budget units
 *   MODUS daily ceiling                  =  500,000 budget units
 *   ⇒ FOUR looks consumed an entire day; 12/hour emptied it in twenty minutes.
 *
 * A cap counted in TRIGGERS is meaningless when a trigger's cost varies 27x by
 * model. This asserts the thing that actually matters: what fraction of a day's
 * allowance the feature can consume while the user is not even looking.
 *
 *   cd apps/web && npx tsx scripts/verify-watch-budget.ts
 */
import { costWeight } from '../lib/chat/model-cost';
import { SCREEN_ASSIST_SYSTEM_PROMPT, MODUS_SYSTEM_PROMPT } from '../lib/claude';

const MODUS_CEILING = 500_000;
const PILOT_CEILING = 1_500_000;

/** Must match apps/desktop/src/main/settings.ts */
const MAX_WATCH_LOOKS_PER_DAY = 30;
/** Must match apps/desktop/src/main/screen/assist.ts */
const WATCH_MODEL = 'gemini-3.5-flash';
/** Must match apps/desktop/src/main/screen/overlay.ts (WATCH_FRAME_EDGE = 800) */
const WATCH_FRAME_TOKENS = 420;   // ~800px JPEG
const FULL_FRAME_TOKENS = 1_200;  // ~1400px JPEG
const LIFE_OS_CTX = 5_600;
const ANSWER = 300;

const tok = (s: string): number => Math.ceil(s.length / 4);

let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const lookCost = (model: string, persona: number, ctx: number, frame: number): number =>
  (persona + ctx + frame * 2 + ANSWER) * costWeight(model);

console.log('\nWhat one watch look costs\n');
const before = lookCost('claude-sonnet-5', tok(MODUS_SYSTEM_PROMPT), LIFE_OS_CTX, FULL_FRAME_TOKENS);
const after = lookCost(WATCH_MODEL, tok(SCREEN_ASSIST_SYSTEM_PROMPT), 0, WATCH_FRAME_TOKENS);
console.log(`  before (auto→Sonnet 5, full context, 1400px) : ${before.toLocaleString()} units`);
console.log(`  after  (pinned ${WATCH_MODEL}, lean, 800px) : ${after.toLocaleString()} units`);
console.log(`  a MODUS day is ${MODUS_CEILING.toLocaleString()} units\n`);

check('the old cost really could empty a day in a few looks',
  Math.floor(MODUS_CEILING / before) <= 5, `${Math.floor(MODUS_CEILING / before)} looks emptied a day`);
check('a look is now a small fraction of a day',
  after / MODUS_CEILING < 0.01, `${((after / MODUS_CEILING) * 100).toFixed(2)}% of a MODUS day`);

console.log('\nA full day of watching, at the daily look cap\n');
const dayTotal = after * MAX_WATCH_LOOKS_PER_DAY;
const pct = (dayTotal / MODUS_CEILING) * 100;
console.log(`  ${MAX_WATCH_LOOKS_PER_DAY} looks x ${after.toLocaleString()} = ${dayTotal.toLocaleString()} units`);
console.log(`  = ${pct.toFixed(1)}% of a MODUS day, ${((dayTotal / PILOT_CEILING) * 100).toFixed(1)}% of a PILOT day\n`);

// The number that matters: a BACKGROUND feature must never be able to spend the
// allowance the user needs for the questions they actually ask.
check('watch cannot take more than a quarter of a MODUS day', pct < 25, `${pct.toFixed(1)}%`);
check('and leaves most of the day for real questions', pct < 15, `${pct.toFixed(1)}%`);

console.log('\nThe brake holds for every model a MODUS user could be on\n');
for (const m of ['gemini-3.5-flash', 'meta/llama-3.3-70b', 'gpt-5.6-terra', 'claude-sonnet-5']) {
  // Watch is PINNED, so the user's Brain must not change the cost at all.
  const cost = lookCost(WATCH_MODEL, tok(SCREEN_ASSIST_SYSTEM_PROMPT), 0, WATCH_FRAME_TOKENS);
  check(`saved Brain ${m} does not change watch's cost`, cost === after, `${cost.toLocaleString()} units`);
}

console.log('\nWorst case: the lean context is NOT deployed yet\n');
// Until the web change ships, prod still assembles the full context. The pinned
// cheap model has to hold the line on its own.
const undeployed = lookCost(WATCH_MODEL, tok(MODUS_SYSTEM_PROMPT), LIFE_OS_CTX, WATCH_FRAME_TOKENS)
  * MAX_WATCH_LOOKS_PER_DAY;
console.log(`  ${MAX_WATCH_LOOKS_PER_DAY} looks against TODAY's production = ${undeployed.toLocaleString()} units`
  + ` (${((undeployed / MODUS_CEILING) * 100).toFixed(0)}% of a MODUS day)`);
check('even undeployed, watch cannot empty a day on its own',
  undeployed < MODUS_CEILING, `${((undeployed / MODUS_CEILING) * 100).toFixed(0)}%`);

console.log(`\n${failures === 0 ? '✅ PASS' : `❌ ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
