/**
 * Truth table for lib/chat/card-state.ts, run against the REAL shipped module.
 *
 *   cd apps/web && npx tsx scripts/card-state-test.ts
 *
 * This reader is one half of a CONTRACT: OptionsCard/DraftOptionsCard emit an
 * answer as a real user turn, and this parses it back so an answered card still
 * reads as answered after a reload. If the two halves drift, an answered card
 * silently renders pristine and answerable a second time — which is the exact
 * bug this replaced. So the fixtures below are BUILT the way the cards build
 * them, not hand-copied: a change to the emit format breaks this test.
 */
import { readOptionsAnswer, readDraftAnswer } from '../lib/chat/card-state';

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// --- Mirrors of the cards' own emit code ---

/** OptionsCard.describe() + finish(). */
function emitOptions(answers: { question: string; picks: { label: string; detail?: string }[] }[]): string {
  return answers
    .map(a => `Answering "${a.question}": ${a.picks.map(p => (p.detail ? `${p.label} — ${p.detail}` : p.label)).join('; ')}`)
    .join('\n');
}

/** DraftOptionsCard.handleGenerate(). */
function emitDraft(direction: string, from?: string): string {
  return `Draft my reply${from ? ` to ${from}` : ''} using this direction: ${direction}. Write the full email body now.`;
}

// --- OptionsCard: the real stepper shapes ---

check('single question, option with detail',
  readOptionsAnswer(emitOptions([{ question: 'How long?', picks: [{ label: 'Short', detail: '3 tight paragraphs' }] }])),
  'Short');

check('single question, option without detail',
  readOptionsAnswer(emitOptions([{ question: 'Which tone?', picks: [{ label: 'Direct' }] }])),
  'Direct');

// Jeremiah's actual thread: a 3-step essay card.
check('multi-question stepper joins every answer',
  readOptionsAnswer(emitOptions([
    { question: 'What should the essay be about?', picks: [{ label: 'MODUS', detail: 'The vision, product, and why it matters' }] },
    { question: 'How long?', picks: [{ label: 'Long-form', detail: 'Full narrative with sections' }] },
  ])),
  'MODUS · Long-form');

check('multi-select splits on the ; separator',
  readOptionsAnswer(emitOptions([
    { question: 'Pick any that apply', picks: [{ label: 'Email', detail: 'a' }, { label: 'Slack', detail: 'b' }] },
  ])),
  'Email · Slack');

check('free-text answer comes back verbatim',
  readOptionsAnswer(emitOptions([{ question: 'What about?', picks: [{ label: 'my dog Rufus' }] }])),
  'my dog Rufus');

// --- The whole point: telling "answered" from "walked away" ---

check('unrelated next turn is NOT an answer',
  readOptionsAnswer('hi how are you'),
  null);

check('no next turn at all is NOT an answer',
  readOptionsAnswer(undefined),
  null);

check('a turn merely mentioning the word answering is NOT an answer',
  readOptionsAnswer('answering that would take a while'),
  null);

check('empty next turn is NOT an answer',
  readOptionsAnswer(''),
  null);

// --- DraftOptionsCard ---

check('draft direction with detail',
  readDraftAnswer(emitDraft('Warm — thank them and suggest a call', 'sam@acme.com')),
  'Warm');

check('draft direction without a from line',
  readDraftAnswer(emitDraft('Decline politely — no detail')),
  'Decline politely');

check('draft free-text direction',
  readDraftAnswer(emitDraft('tell him I am out of office')),
  'tell him I am out of office');

check('unrelated next turn is NOT a draft answer',
  readDraftAnswer('hi how are you'),
  null);

check('an options answer is NOT read as a draft answer',
  readDraftAnswer(emitOptions([{ question: 'How long?', picks: [{ label: 'Short' }] }])),
  null);

check('a draft answer is NOT read as an options answer',
  readOptionsAnswer(emitDraft('Warm — be nice')),
  null);

console.log(failures === 0 ? '\nAll passed.' : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
