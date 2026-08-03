/**
 * What does one Screen Assist question actually cost against the plan ceiling?
 *
 * 🚨 THE QUESTION THIS ANSWERS. A day of testing burned ~620,000 budget units in
 * twenty minutes and looked like a runaway loop. It was not. It was five
 * questions, each costing a quarter of a day's allowance, because:
 *
 *   · MODUS_SYSTEM_PROMPT is ~5,800 tokens and rides on EVERY message
 *   · the life-OS context (inbox, calendar, notes, memory, connectors) added ~5,600
 *   · the account's Brain is `auto`, which routes to Claude Sonnet 5 — cost weight 9x
 *
 * ⚠️ The counters store COST UNITS, not tokens (lib/chat/model-cost.ts): one Fable 5
 * token is 27 Llama tokens of spend. "620,919 tokens" in the UI is 620,919 units.
 * Confusing the two makes a $9 day look like a catastrophe, or a catastrophe look
 * like $9 — this script exists so nobody has to guess which.
 *
 *   cd apps/web && npx tsx scripts/verify-screen-cost.ts
 */
import { costWeight, estimatedCostUsd } from '../lib/chat/model-cost';
import { MODUS_SYSTEM_PROMPT, SCREEN_ASSIST_SYSTEM_PROMPT } from '../lib/claude';
import { PLATFORM_MODELS } from '../lib/models';

const MODUS_CEILING = 500_000;
const tok = (s: string): number => Math.ceil(s.length / 4);

const FULL_PERSONA = tok(MODUS_SYSTEM_PROMPT);
const LEAN_PERSONA = tok(SCREEN_ASSIST_SYSTEM_PROMPT);
const LIFE_OS_CTX = 5_600;   // inbox + calendar + notes + messages + contacts + memory + connectors
const SCREENSHOT = 1_200;    // 1400px JPEG
const ANSWER = 500;

const before = FULL_PERSONA + LIFE_OS_CTX + SCREENSHOT + ANSWER;
const after = LEAN_PERSONA + SCREENSHOT + ANSWER;

let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log('\nSystem prompt\n');
console.log(`  life-OS persona : ${FULL_PERSONA.toLocaleString()} tokens, every message`);
console.log(`  screen persona  : ${LEAN_PERSONA.toLocaleString()} tokens`);
check('the screen prompt is dramatically smaller', LEAN_PERSONA < FULL_PERSONA / 8,
  `${Math.round(FULL_PERSONA / LEAN_PERSONA)}x smaller`);

console.log('\nOne screen question, raw tokens\n');
console.log(`  before: ${before.toLocaleString()}   after: ${after.toLocaleString()}`);
check('screenMode cuts a screen question by more than half', after < before / 2,
  `${Math.round((1 - after / before) * 100)}% cheaper`);

console.log('\nQuestions per day on the MODUS ceiling (500,000 units)\n');
console.log('  model                       weight   before   after');
for (const m of PLATFORM_MODELS.filter((x) => x.plans.includes('modus'))) {
  const w = costWeight(m.id);
  const b = Math.floor(MODUS_CEILING / (before * w));
  const a = Math.floor(MODUS_CEILING / (after * w));
  console.log(`  ${m.name.padEnd(26)} ${String(w).padStart(4)}x ${String(b).padStart(8)} ${String(a).padStart(7)}`);
  // The floor that matters: the most expensive model a MODUS user can pick must
  // still allow a usable number of questions, or the feature is unusable on the
  // plan it ships to.
  check(`  ${m.name}: at least 15 questions/day after the fix`, a >= 15, `${a}/day`);
}

console.log('\nWhat the numbers actually mean in money\n');
const sonnetW = costWeight('claude-sonnet-5');
console.log(`  620,919 units on Claude Sonnet 5 ≈ ${Math.round(620919 / sonnetW).toLocaleString()} raw tokens`
  + ` ≈ $${estimatedCostUsd('claude-sonnet-5', 620919 / sonnetW).toFixed(2)}`);
console.log(`  the whole 500,000/day ceiling    ≈ $${estimatedCostUsd('claude-sonnet-5', MODUS_CEILING / sonnetW).toFixed(2)} of model spend on a $24/mo plan`);

console.log(`\n${failures === 0 ? '✅ PASS' : `❌ ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
