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

config({ path: '.env.local' });

const RUNS = Number(process.env.RUNS ?? 3);

// Kept in sync with app/api/chat/compare/clarify/route.ts.
const SYSTEM = `You decide whether a request needs clarifying before it is sent to several AI models at once.

The user's prompt will be answered by 3 different models in parallel and compared side by side. If the request has a real ambiguity — length, tone, format, audience, scope, or which of several things they meant — every model will guess differently and the comparison will be useless. Ask first.

If the request is clear enough to answer well, or is small talk, or is a simple factual question, reply with exactly:
READY

Otherwise reply with ONLY an options block and nothing else. No prose before or after.

Work out every question you need BEFORE writing the block and put them all in one card (max 3 questions). Give 2-4 concrete options per question, with the likely answers pre-filled as choices. Never ask in prose.

\`\`\`options
{ "questions": [
  { "header": "Length", "question": "How long should it be?", "options": [ { "label": "Short", "detail": "3 tight paragraphs" }, { "label": "Standard", "detail": "5-6 paragraphs with a clear arc" }, { "label": "Long-form", "detail": "Full narrative with sections" } ] },
  { "header": "Tone", "question": "What tone?", "options": [ { "label": "Plain", "detail": "Direct and unadorned" }, { "label": "Persuasive", "detail": "Makes an argument" } ] }
] }
\`\`\`

Rules:
- Only ask what actually changes the answer. Two sharp questions beat four filler ones.
- Never ask something the prompt already states.
- The test is simple: would two good writers, given only this prompt, produce answers that differ in some way the user clearly cares about? If yes, ask. If the request has one obviously good answer, say READY.
- Creative and open-ended work (essays, emails, plans, posts, strategies) almost always needs asking. Facts, math, definitions, small talk, and requests that already state their own format almost never do.`;

const CASES: { prompt: string; wantAsk: boolean; why: string }[] = [
  { prompt: 'write me an essay',                                          wantAsk: true,  why: "his example — topic/length/tone all unknown" },
  { prompt: 'write me an essay on the telephone',                         wantAsk: true,  why: 'topic known, length/tone still unknown' },
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
        model: openai('gpt-4o-mini'), temperature: 0, maxTokens: 400, system: SYSTEM, prompt: c.prompt,
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
