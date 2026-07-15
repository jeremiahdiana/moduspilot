/**
 * Does the multi-model clarify gate reach the right verdict?
 *
 * Three failure modes, all bad:
 *   - asks on "what's 2+2"          -> friction in front of an obvious answer
 *   - stays READY on "write me an essay" -> 3 models guess 3 different essays
 *   - runs "generate an image"      -> 3 text models say they can't, 5 calls wasted
 *
 * Rates, not samples. And read the ⚠️ on "help me plan my week" before you
 * believe any single failure here: gpt-4o-mini drifts on its own, over time.
 *
 *   cd apps/web && RUNS=3 npx tsx scripts/clarify-eval.ts
 */
import { config } from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
// Same prompt AND same parser the route runs — never a copy. A hand-synced eval
// scores a behaviour the route may no longer have.
import { CLARIFY_SYSTEM, classifyClarifyReply } from '../lib/chat/clarify-prompt';

config({ path: '.env.local' });

const RUNS = Number(process.env.RUNS ?? 3);

/** What the gate should decide. Mirrors ClarifyReply minus the error kinds. */
type Want = 'ask' | 'ready' | 'image' | 'document' | 'chart';

const CASES: { prompt: string; want: Want; why: string }[] = [
  { prompt: 'write me an essay',                                          want: 'ask',   why: "his example — topic/length/tone all unknown" },
  // 2026-07-16: his multi-model run on this fanned out WITHOUT a card and the
  // three models wrote about three different subjects. The gate measures 3/3 on
  // it, so the miss was the gate erroring and being skipped in silence, not the
  // prompt. Pinned so a future prompt edit can't quietly make it a real gap.
  { prompt: 'generate any essay',                                         want: 'ask',   why: 'his exact wording — "any" makes topic wide open' },
  { prompt: 'write me an essay on the telephone',                         want: 'ask',   why: 'topic known, length/tone still unknown' },
  // ⚠️ FLAKY ACROSS TIME — the most misleading case in this file. Measured
  // 2026-07-16 at 0/6 (ask) and, ~20 minutes later, 2/2 on a byte-identical
  // prompt. gpt-4o-mini at temperature 0 is NOT stable between requests, and the
  // variance is across TIME, not within a batch — so taking n=6 in one burst
  // reads as a confident hard verdict and is worth nothing. If this fails, re-run
  // it later before believing it, and NEVER tune the prompt on it: it drifts on
  // its own, and fitting one case is how the other nine break.
  { prompt: 'help me plan my week',                                       want: 'ask',   why: 'scope genuinely unknown' },
  { prompt: 'write a cold email to a fitness brand about a partnership',  want: 'ask',   why: 'tone/length matter a lot' },
  { prompt: "what's 2+2",                                                 want: 'ready', why: 'obvious — a card here is friction' },
  { prompt: 'what is the capital of France',                              want: 'ready', why: 'simple factual' },
  { prompt: 'hi',                                                         want: 'ready', why: 'small talk' },
  { prompt: 'explain compound interest to a 10 year old in one paragraph', want: 'ready', why: 'audience + length already stated' },
  { prompt: 'summarize this in exactly 3 bullet points: the meeting ran long and we agreed to ship Friday', want: 'ready', why: 'format stated' },

  // Artifact requests: comparing models is text-only, so these must never fan out.
  { prompt: 'generate an image of a cat',                                 want: 'image', why: 'the deliverable is a picture' },
  { prompt: 'make me a logo for my company',                              want: 'image', why: 'a logo is a visual' },
  { prompt: 'make me a PDF of my meeting notes',                          want: 'document', why: 'the deliverable is a file' },
  { prompt: 'chart my revenue over the last year',                        want: 'chart', why: 'the deliverable is a plot' },

  // The trap: about an artifact vs wanting one. These want WRITING and must not
  // trip the guard — judging the subject instead of the deliverable would make
  // multi-model refuse ordinary questions.
  { prompt: 'write an essay about photography',                           want: 'ask',   why: 'wants prose, mentions images' },
  { prompt: 'explain how charts work',                                    want: 'ready', why: 'wants an explanation, mentions charts' },
  { prompt: 'what makes a good logo',                                     want: 'ready', why: 'wants an opinion, mentions logos' },
];

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('No OPENAI_API_KEY in .env.local'); process.exit(1); }
  const openai = createOpenAI({ apiKey: key });

  let wrong = 0, malformed = 0, prose = 0;

  for (const c of CASES) {
    const got: Record<string, number> = {};
    const qCounts: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'), temperature: 0, maxTokens: 400, system: CLARIFY_SYSTEM, prompt: c.prompt,
      });
      const reply = classifyClarifyReply(text);
      const label =
        reply.kind === 'unsupported' ? reply.artifact
        : reply.kind === 'options' ? 'ask'
        : reply.kind;
      got[label] = (got[label] ?? 0) + 1;
      if (reply.kind === 'malformed') malformed++;
      if (reply.kind === 'prose') prose++;
      if (reply.kind === 'options') {
        const p = JSON.parse(reply.raw) as { questions?: unknown[] };
        qCounts.push(Array.isArray(p.questions) ? p.questions.length : 1);
      }
    }
    const hits = got[c.want] ?? 0;
    const ok = hits === RUNS;
    if (!ok) wrong++;
    const breakdown = Object.entries(got).map(([k, n]) => `${k}×${n}`).join(' ');
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${hits}/${RUNS} want ${c.want.toUpperCase().padEnd(8)}` +
      `${qCounts.length ? `(${qCounts.join(',')} questions) ` : ''}— ${c.prompt.slice(0, 44)}`,
    );
    if (!ok) console.log(`        got: ${breakdown}   (${c.why})`);
  }

  console.log(`\n──────── ${CASES.length * RUNS} generations ────────`);
  console.log(`cases with wrong verdict:  ${wrong}/${CASES.length}`);
  console.log(`malformed option blocks:   ${malformed}`);
  console.log(`leaked into prose:         ${prose}`);
}

main().catch(e => { console.error(e); process.exit(1); });
