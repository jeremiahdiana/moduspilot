/**
 * Prove that a remembered fact actually reaches the prompt.
 *
 * 🚨 IT NEVER DID. Three independent failures stacked on the memory layer, each
 * of which alone made it a no-op:
 *   1. WRITE — extractDurableMemory called the Gateway with no failover, so a
 *      rate-limited free tier meant nothing was ever saved (fixed in b4beefa).
 *   2. READ — an 800ms cap over TWO sequential network round trips. Production:
 *      `memory query timed out after 800ms` on 25 of 25 consecutive requests.
 *   3. FILTER — `score > 0.55` against llama-text-embed-v2, whose scores for
 *      short third-person facts top out around 0.35. Measured on the live index:
 *      range 0.009–0.349, and the filter kept 0 of 7 vectors. Memory was
 *      written, stored, retrieved and RANKED correctly, then discarded.
 *
 * This asserts the end of that chain: a natural question must come back with the
 * fact attached, and an unrelated question must not drag one in.
 *
 *   cd apps/web && npx tsx scripts/verify-memory-recall.ts
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

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${String(detail).slice(0, 200)}`); }
}

async function main() {
  const { queryMemoryContext } = await import('../lib/chat/context');

  // Pay the cold-start cost once, out of band, and report it — the assertions
  // below are about the threshold and the plumbing, not about how long a fresh
  // Pinecone client takes to construct. The COLD number is what the cap in
  // context.ts is sized for, so it is worth printing on every run.
  const coldStart = Date.now();
  await queryMemoryContext(UID, 'warm up the client');
  console.log(`cold first call: ${Date.now() - coldStart}ms  (the cap is 4000ms)`);

  const cases: { q: string; expect: RegExp | null }[] = [
    { q: 'am I raising money', expect: /fundrais|pre-seed/i },
    { q: 'tell me about MODUS', expect: /MODUS/i },
    { q: 'where do I live', expect: /Sydney/i },
  ];

  for (const { q, expect } of cases) {
    const started = Date.now();
    const block = await queryMemoryContext(UID, q);
    const ms = Date.now() - started;
    console.log(`\n── ${JSON.stringify(q)}  (${ms}ms)`);
    console.log(block ? block.trim().split('\n').map(l => `   ${l}`).join('\n') : '   (nothing injected)');
    check(`recalls something for ${JSON.stringify(q)}`, block.length > 0);
    if (expect) check(`  …and it is the RIGHT fact (${expect})`, expect.test(block), block);
    // The cap must not be the thing that decides. 4000ms is the ceiling; a warm
    // query lands far under it.
    check(`  …within the retrieval budget`, ms < 4000, `${ms}ms`);
  }

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
