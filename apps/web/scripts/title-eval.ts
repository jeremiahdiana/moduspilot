/**
 * Eval for /api/chat/title. Titles are model output, so a single sample proves
 * nothing (see the prompt-eval lesson: measure rates, never single samples).
 * Runs each case N times and reports every distinct title produced.
 *
 *   cd apps/web && npx tsx scripts/title-eval.ts
 */
import { config } from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

// tsx does NOT load .env.local on its own — without this the key is undefined
// and every case fails for the wrong reason.
config({ path: '.env.local' });

const RUNS = Number(process.env.RUNS ?? 3);
const MAX_TITLE_CHARS = 60;

// Kept byte-identical to app/api/chat/title/route.ts.
const SYSTEM =
  'You name chat conversations. Reply with ONLY a title of 3 to 5 words that captures what the ' +
  'conversation is about. Use sentence case. No quotes, no punctuation at the end, no emoji, and ' +
  'never prefix it with "Title:". If the exchange is only a greeting or small talk, reply exactly: ' +
  'Quick hello';

function tidy(raw: string): string {
  let t = raw.trim().split('\n')[0].trim();
  t = t.replace(/^["'`]|["'`]$/g, '').replace(/[.]+$/, '').trim();
  if (t.length > MAX_TITLE_CHARS) t = t.slice(0, MAX_TITLE_CHARS).trimEnd();
  return t;
}

// Drawn from the real sidebar in Jeremiah's screenshot.
const CASES: { user: string; assistant: string; want: string }[] = [
  {
    user: 'Show how $10,000 grows over 20 years with annual compounding, comparing 4%, 7%, and 10% side by side. Plot all three rates as a line chart over time (label the years), and put the final balance for each rate in a table below.',
    assistant: "Here's how $10,000 grows over 20 years with annual compounding at rates of 4%, 7%, and 10%.",
    want: 'compound interest / growth',
  },
  { user: '.', assistant: "What's on your mind?", want: 'small talk -> Quick hello' },
  { user: 'HOW ARE YOU', assistant: "I'm here and ready. What do you need?", want: 'small talk -> Quick hello' },
  { user: 'yo gang whats up', assistant: 'I have the following on your plate today...', want: 'small talk-ish' },
  { user: 'make a PDF of my Q3 roadmap', assistant: "Here's a clean PDF of your Q3 roadmap.", want: 'Q3 roadmap PDF' },
  { user: 'can you make in image of a purple logo for my app', assistant: 'image { "prompt": "purple logo" }', want: 'logo image' },
  { user: 'help me plan my week', assistant: 'Sure. What are your top priorities?', want: 'weekly planning' },
  { user: 'write me a cold email to a fitness brand about a partnership', assistant: 'Here is a short cold email...', want: 'cold email / partnership' },
];

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('No OPENAI_API_KEY in .env.local'); process.exit(1); }
  const openai = createOpenAI({ apiKey: key });

  let tooLong = 0;
  let empty = 0;

  for (const c of CASES) {
    const seen: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        temperature: 0.2,
        maxTokens: 16,
        system: SYSTEM,
        prompt: `User: ${c.user}\n\nAssistant: ${c.assistant}\n\nTitle:`,
      });
      const t = tidy(text);
      seen.push(t);
      const words = t.split(/\s+/).filter(Boolean).length;
      if (words > 6) tooLong++;
      if (t.length < 2) empty++;
    }
    const uniq = Array.from(new Set(seen));
    console.log(`\nUSER: ${c.user.slice(0, 62)}${c.user.length > 62 ? '…' : ''}`);
    console.log(`  want:  ${c.want}`);
    console.log(`  got:   ${uniq.map(u => `"${u}"`).join('  |  ')}`);
    console.log(`  stable: ${uniq.length === 1 ? 'yes' : `NO (${uniq.length} variants across ${RUNS} runs)`}`);
  }

  console.log(`\n──────── totals over ${CASES.length * RUNS} generations ────────`);
  console.log(`over 6 words: ${tooLong}`);
  console.log(`empty/too short: ${empty}`);
}

main().catch(e => { console.error(e); process.exit(1); });
