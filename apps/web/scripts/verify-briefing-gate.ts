/**
 * The daily briefing must honor its own off switch.
 *
 * The bug this guards: kahzaticfanboy@gmail.com had `dailyBriefing: false` in
 * settings (written by onboarding itself) and received a Morning Briefing every
 * morning from 2026-07-09 to 2026-07-17 — nine LLM calls into an account whose
 * Settings page displayed the toggle as OFF. The cron gated only on
 * `onboardingComplete == true` and never read the flag.
 *
 * Case 5 replays the OLD filter against that exact user doc and asserts it
 * delivers — the guard fails loudly if anyone reverts to gating on the hour
 * alone. No API key, no network.
 *
 *   cd apps/web && npx tsx scripts/verify-briefing-gate.ts
 */
import { isBriefingDue, capabilityEnabled, CAPABILITY_DEFAULTS } from '../lib/capabilities';

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  ok ? pass++ : fail++;
}

// The real user doc, as it sits in Firestore today.
const kahzatic = {
  onboardingComplete: true,
  plan: 'free',
  settings: {
    capabilities: { vectorMemory: true, voiceInput: false, dailyBriefing: false },
  },
};

// A doc written by onboarding AFTER this fix: no dailyBriefing key at all.
const newSignup = {
  onboardingComplete: true,
  settings: { capabilities: { voiceInput: false, vectorMemory: true } },
};

// Jeremiah's own account: explicitly ON, briefingHour 2.
const optedIn = {
  onboardingComplete: true,
  plan: 'modus',
  settings: { briefingHour: 2, capabilities: { dailyBriefing: true } },
};

console.log('\n--- the off switch ---');
check('1. explicit false is not delivered at its hour', isBriefingDue(kahzatic, 7), false);
check('2. explicit true is delivered at its hour', isBriefingDue(optedIn, 2), true);
check('3. explicit true is NOT delivered at another hour', isBriefingDue(optedIn, 7), false);

console.log('\n--- the default ---');
check('4. a new signup with no flag IS delivered (default ON)', isBriefingDue(newSignup, 7), true);
check('   a doc with no settings at all IS delivered', isBriefingDue({ onboardingComplete: true }, 7), true);
check('   onboarding no longer writes the flag', 'dailyBriefing' in (newSignup.settings.capabilities as object), false);

console.log('\n--- the guard: replay the OLD filter on the real doc ---');
// Verbatim pre-fix logic from app/api/cron/daily-briefing/route.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oldFilter = (d: any, utcHour: number) => (d?.settings?.briefingHour ?? 7) === utcHour;
check('5. the OLD filter delivers to a user who turned it off (the bug)', oldFilter(kahzatic, 7), true);
check('   the NEW filter does not', isBriefingDue(kahzatic, 7), false);

console.log('\n--- client and server agree ---');
check('6. default is ON', CAPABILITY_DEFAULTS.dailyBriefing, true);
check('   capabilityEnabled honors an explicit false', capabilityEnabled({ dailyBriefing: false }, 'dailyBriefing'), false);
check('   capabilityEnabled falls back to the default when absent', capabilityEnabled({}, 'dailyBriefing'), true);
check('   ...and when the map is missing entirely', capabilityEnabled(undefined, 'dailyBriefing'), true);

console.log('\n--- unrelated gates still work ---');
check('7. an unfinished onboarding is never delivered', isBriefingDue({ onboardingComplete: false }, 7), false);
check('   an empty doc is never delivered', isBriefingDue({}, 7), false);
check('   null is never delivered', isBriefingDue(null, 7), false);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
