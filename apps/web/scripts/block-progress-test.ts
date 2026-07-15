/**
 * Truth table for lib/chat/block-progress.ts, run against the REAL shipped
 * module. Simulates a chart block arriving one character at a time, which is
 * how the parser actually sees it.
 *
 *   cd apps/web && npx tsx scripts/block-progress-test.ts
 */
import { blockProgress, countStreamedRows } from '../lib/chat/block-progress';

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// The exact shape the prompt now asks for, from Jeremiah's compounding query.
const full =
  'Here is the growth.\n\n```chart\n{ "type": "line", "title": "Growth of $10,000", "unit": "$", "points": 21, "data": [' +
  Array.from({ length: 21 }, (_, y) => `{ "label": "Year ${y}", "4%": ${10000 * 1.04 ** y}, "7%": ${10000 * 1.07 ** y} }`).join(', ') +
  '] }\n```';

// --- row counting on partial input ---
check('no data array yet', countStreamedRows('```chart\n{ "type": "line", "points": 21,'), 0);
check('open array, no rows', countStreamedRows('"data": ['), 0);
check('one complete row', countStreamedRows('"data": [{ "label": "Year 0", "value": 1 }'), 1);
check('half-written row not counted', countStreamedRows('"data": [{ "label": "Year 0", "value": 1 }, { "label": "Yea'), 1);
check('all 21 rows', countStreamedRows(full), 21);
// A brace inside a label must not inflate the count.
check('brace inside a string label', countStreamedRows('"data": [{ "label": "a}b}c", "value": 1 }'), 1);
check('escaped quote inside label', countStreamedRows('"data": [{ "label": "he said \\"hi\\"", "value": 1 }'), 1);

// --- percentage is monotonic and never hits 100 while streaming ---
let last = 0;
let sawReal = false;
let brokeMonotonic = false;
for (let i = 1; i <= full.length; i++) {
  const p = blockProgress(full.slice(0, i));
  if (!p || p.percent === null) continue;
  sawReal = true;
  if (p.percent < last) brokeMonotonic = true;
  last = p.percent;
  if (p.percent > 99) { console.log('FAIL  percent exceeded 99 mid-stream'); failures++; break; }
}
check('reported a real percentage while streaming', sawReal, true);
check('percentage never went backwards', brokeMonotonic, false);
check('reached 99 by the end of the block', last, 99);

// --- honest fallback when the model omits "points" ---
const noPoints = '```chart\n{ "type": "bar", "data": [{ "label": "Feb", "value": 1 }, { "label": "Mar", "value": 2 }';
check('omitted points -> indeterminate, not invented', blockProgress(noPoints), {
  label: 'Building chart', percent: null, detail: '2 points so far',
});

// --- a partway snapshot reports the true fraction ---
const partway = full.slice(0, full.indexOf('"Year 11"'));
const p11 = blockProgress(partway)!;
check('11 of 21 rows -> 11 of 21 points', p11.detail, '11 of 21 points');
check('11/21 -> 52%', p11.percent, 52);

// --- other block types still resolve ---
check('image block', blockProgress('```image\n{')!.label, 'Creating image');
check('options block', blockProgress('```options\n{')!.label, 'Preparing question');
check('draft_options is not matched by the options branch', blockProgress('```draft_options\n{')!.label, 'Preparing options');
check('plain prose -> no progress', blockProgress('Just a normal answer.'), null);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
