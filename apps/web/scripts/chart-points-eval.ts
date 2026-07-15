/**
 * Does the MODEL actually emit "points", and emit it BEFORE "data"?
 *
 * The component being right is not the same as the model using it — a question
 * card once shipped that never fired because the prompt never overrode the
 * model's default. This checks the wire, not the component. Rates, not samples.
 *
 *   cd apps/web && RUNS=3 npx tsx scripts/chart-points-eval.ts
 */
import { config } from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { MODUS_SYSTEM_PROMPT } from '../lib/claude';
import { blockProgress } from '../lib/chat/block-progress';

config({ path: '.env.local' });

const RUNS = Number(process.env.RUNS ?? 3);
const MODEL = process.env.MODEL ?? 'gpt-4o';

const QUERIES = [
  // Jeremiah's actual query from the screenshot.
  'Show how $10,000 grows over 20 years with annual compounding, comparing 4%, 7%, and 10% side by side. Plot all three rates as a line chart over time (label the years), and put the final balance for each rate in a table below.',
  'chart my revenue: Jan 12k, Feb 18k, Mar 22k, Apr 31k',
  'graph the breakdown of my time: work 45%, sleep 30%, gym 10%, other 15%',
];

function extractChart(text: string): string | null {
  const m = /```chart\s*([\s\S]*?)```/.exec(text);
  return m ? m[1].trim() : null;
}

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('No OPENAI_API_KEY in .env.local'); process.exit(1); }
  const openai = createOpenAI({ apiKey: key });

  let total = 0, emittedChart = 0, hasPoints = 0, pointsBeforeData = 0, pointsCorrect = 0;

  for (const q of QUERIES) {
    console.log(`\nQUERY: ${q.slice(0, 66)}${q.length > 66 ? '…' : ''}`);
    for (let i = 0; i < RUNS; i++) {
      total++;
      const { text } = await generateText({
        model: openai(MODEL),
        temperature: 0,
        system: MODUS_SYSTEM_PROMPT,
        prompt: q,
      });
      const chart = extractChart(text);
      if (!chart) { console.log(`  run ${i + 1}: NO CHART BLOCK`); continue; }
      emittedChart++;

      const pIdx = chart.indexOf('"points"');
      const dIdx = chart.indexOf('"data"');
      const has = pIdx !== -1;
      const before = has && dIdx !== -1 && pIdx < dIdx;
      if (has) hasPoints++;
      if (before) pointsBeforeData++;

      let declared: number | null = null, actual: number | null = null, ok = false;
      try {
        const parsed = JSON.parse(chart) as { points?: number; data?: unknown[] };
        declared = parsed.points ?? null;
        actual = Array.isArray(parsed.data) ? parsed.data.length : null;
        ok = declared !== null && declared === actual;
        if (ok) pointsCorrect++;
      } catch { /* invalid JSON is its own failure, reported below */ }

      // Prove the shipped parser derives a real percentage from this exact block.
      const partial = '```chart\n' + chart.slice(0, chart.indexOf('"data"') + 40);
      const prog = blockProgress(partial);

      console.log(
        `  run ${i + 1}: points=${has ? 'yes' : 'NO'} before-data=${before ? 'yes' : 'NO'} ` +
        `declared=${declared} actual=${actual} match=${ok ? 'yes' : 'NO'} ` +
        `parser=${prog?.percent !== null && prog?.percent !== undefined ? `${prog.percent}%` : 'indeterminate'}`,
      );
    }
  }

  console.log(`\n──────── ${MODEL}, ${total} generations ────────`);
  console.log(`chart block emitted:     ${emittedChart}/${total}`);
  console.log(`"points" present:        ${hasPoints}/${emittedChart}`);
  console.log(`"points" before "data":  ${pointsBeforeData}/${emittedChart}   <- required for real progress`);
  console.log(`"points" === data.length:${pointsCorrect}/${emittedChart}`);
}

main().catch(e => { console.error(e); process.exit(1); });
