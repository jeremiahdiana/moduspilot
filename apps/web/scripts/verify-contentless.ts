/**
 * A keystroke must never become a documentation lookup.
 *
 * A lone "." is not small talk (SMALL_TALK needs a word), so it used to arrive
 * at Llama 3.3 holding GitMCP's full toolset. Measured on prod 2026-07-23:
 * 3 of 5 sends returned ZERO characters — the model spent its steps calling
 * tools and never emitted text, leaving the composer typing forever — and one
 * answered a period with 7,785 characters about the React docs repo.
 *
 * The risk in the fix is the opposite direction: an ASCII-only test would call
 * 日本語 / العربية / Кириллица "contentless" and strip their tools silently.
 * Those cases are asserted here for exactly that reason.
 *
 *   cd apps/web && npx tsx scripts/verify-contentless.ts
 */
import { isContentlessQuery } from '../lib/chat/context';

const CASES: [string, boolean][] = [
  // contentless — no word to act on
  ['.', true], ['..', true], ['...', true], ['?', true], ['!!!', true],
  ['', true], ['   ', true], ['a', true], ['-', true], [',', true], ['/', true],
  ['👍', true], ['🙂🙂', true],
  // real input — must keep its tools
  ['ok', false], ['hi', false], ['what is on my calendar', false],
  ['日本語で答えて', false], ['مرحبا كيف حالك', false], ['Привет как дела', false],
  ['café', false], ['C3', false], ['a1', false], ['fix my bug', false],
  ['read github.com/foo/bar', false],
];

let failed = 0;
for (const [input, want] of CASES) {
  const got = isContentlessQuery(input);
  if (got !== want) {
    failed++;
    console.log(`❌ ${JSON.stringify(input)} → contentless=${got}, expected ${want}`);
  }
}

console.log(failed === 0
  ? `✅ ${CASES.length}/${CASES.length} — punctuation is skipped, every script keeps its tools`
  : `❌ ${failed}/${CASES.length} failed`);
process.exit(failed === 0 ? 0 : 1);
