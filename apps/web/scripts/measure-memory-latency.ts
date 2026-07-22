/**
 * Measure what memory retrieval ACTUALLY costs, so its timeout is a measurement
 * and not a guess.
 *
 * queryMemory does two sequential network round trips — embedText(), then a
 * Pinecone query — and sat behind an 800ms cap. Production logs showed that cap
 * being hit on 25 of 25 consecutive requests, i.e. retrieval never once
 * succeeded: memories were written and never read back.
 *
 *   cd apps/web && npx tsx scripts/measure-memory-latency.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const UID = process.env.MODUS_UID || 'hSBcOHKSX9eCHaKSDczccTRzv093';

async function main() {
  const { queryMemory } = await import('../lib/pinecone');
  const queries = [
    'where do I live',
    'what am I working on',
    'what are my goals this quarter',
    'who do I work with',
    'what is my role',
  ];

  console.log('\n── full queryMemory() (embed + Pinecone) ──');
  const totals: number[] = [];
  for (const q of queries) {
    const t = Date.now();
    const matches = await queryMemory(UID, q, 4);
    const ms = Date.now() - t;
    totals.push(ms);
    const top = matches[0] as { score?: number } | undefined;
    console.log(`  ${String(ms).padStart(5)}ms  ${matches.length} matches  top=${top?.score?.toFixed(3) ?? '—'}  ${q}`);
  }

  const stat = (a: number[]) => ({
    min: Math.min(...a),
    max: Math.max(...a),
    avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length),
  });
  const t = stat(totals);
  console.log(`total  min=${t.min}ms avg=${t.avg}ms max=${t.max}ms`);
  console.log(`\nold cap was 800ms → ${totals.filter(x => x > 800).length}/${totals.length} would have TIMED OUT`);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
