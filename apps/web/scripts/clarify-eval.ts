/**
 * Does the multi-model clarify gate ask ONLY when it should?
 *
 * Two failure modes, both bad:
 *   - asks on "what's 2+2"  -> friction in front of an obvious answer
 *   - stays READY on "write me an essay" -> 3 models guess 3 different essays
 *
 * Rates, not samples.
 *
 *   cd apps/web && RUNS=3 npx tsx scripts/clarify-eval.ts
 */
import { config } from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { CLARIFY_SYSTEM } from '../lib/chat/clarify-prompt';

config({ path: '.env.local' });

const RUNS = Number(process.env.RUNS ?? 3);


const CASES: { prompt: string; wantAsk: boolean; why: string }[] = [
  { prompt: 'write me an essay',                                          wantAsk: true,  why: "his example — topic/length/tone all unknown" },
  // 2026-07-16: his multi-model run on this fanned out WITHOUT a card and the
  // three models wrote about three different subjects. The gate measures 3/3 on
  // it, so the miss was the gate erroring and being skipped in silence, not the
  // prompt. Pinned so a future prompt edit can't quietly make it a real gap.
  { prompt: 'generate any essay',                                         wantAsk: true,  why: 'his exact wording — "any" makes topic wide open' },
  { prompt: 'write me an essay on the telephone',                         wantAsk: true,  why: 'topic known, length/tone still unknown' },
  // ⚠️ KNOWN FAILING, PRE-EXISTING — measured 2026-07-16 at n=6: 0/6, a hard
  // stable READY, not sampling noise. NOT a regression: the prompt was moved to
  // lib/chat/clarify-prompt.ts byte-identically (verified by diff against the
  // shipped copy) and behaviour is unchanged. Oddly phrasing-specific — "plan my
  // week for me" asks 6/6 and "help me plan my week please" asks 5/6, so the gate
  // understands the intent and balks only at this exact wording. Left alone
  // deliberately: tuning the prompt against one case is how the other 9 break.
  { prompt: 'help me plan my week',                                       wantAsk: true,  why: 'scope genuinely unknown' },
  { prompt: 'write a cold email to a fitness brand about a partnership',  wantAsk: true,  why: 'tone/length matter a lot' },
  { prompt: "what's 2+2",                                                 wantAsk: false, why: 'obvious — a card here is friction' },
  { prompt: 'what is the capital of France',                              wantAsk: false, why: 'simple factual' },
  { prompt: 'hi',                                                         wantAsk: false, why: 'small talk' },
  { prompt: 'explain compound interest to a 10 year old in one paragraph', wantAsk: false, why: 'audience + length already stated' },
  { prompt: 'summarize this in exactly 3 bullet points: the meeting ran long and we agreed to ship Friday', wantAsk: false, why: 'format stated' },
];

function parses(raw: string): boolean {
  try {
    const p = JSON.parse(raw) as { questions?: unknown[]; question?: string };
    return (Array.isArray(p.questions) && p.questions.length > 0) || typeof p.question === 'string';
  } catch { return false; }
}

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('No OPENAI_API_KEY in .env.local'); process.exit(1); }
  const openai = createOpenAI({ apiKey: key });

  let wrong = 0, unparseable = 0, prose = 0;

  for (const c of CASES) {
    let asked = 0;
    const qCounts: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'), temperature: 0, maxTokens: 400, system: CLARIFY_SYSTEM, prompt: c.prompt,
      });
      const m = /```options\s*([\s\S]*?)```/.exec(text);
      if (m) {
        asked++;
        if (!parses(m[1].trim())) unparseable++;
        else {
          const p = JSON.parse(m[1].trim()) as { questions?: unknown[] };
          qCounts.push(Array.isArray(p.questions) ? p.questions.length : 1);
        }
      } else if (!/^READY\s*$/i.test(text.trim())) {
        // Neither a block nor READY = it answered in prose. The gate leaked.
        prose++;
      }
    }
    const rate = asked / RUNS;
    const want = c.wantAsk ? 1 : 0;
    const ok = rate === want;
    if (!ok) wrong++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  asked ${asked}/${RUNS}  want ${c.wantAsk ? 'ASK' : 'READY'}` +
      `${qCounts.length ? `  (${qCounts.join(',')} questions)` : ''}  — ${c.prompt.slice(0, 46)}`,
    );
    if (!ok) console.log(`        ${c.why}`);
  }

  console.log(`\n──────── ${CASES.length * RUNS} generations ────────`);
  console.log(`cases with wrong ask/ready rate: ${wrong}/${CASES.length}`);
  console.log(`unparseable option blocks:       ${unparseable}`);
  console.log(`leaked into prose:               ${prose}`);
}

main().catch(e => { console.error(e); process.exit(1); });
