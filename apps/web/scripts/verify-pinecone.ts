/**
 * Verifies the Pinecone memory pipeline that the memory-upsert Inngest job
 * depends on:
 *   1. READ — query the real user's memories (proves embed + index reachable +
 *      that production upserts have been landing).
 *   2. ROUND-TRIP — upsert → query-back → delete under a throwaway userId, so
 *      the real index data is never touched.
 *
 *   cd apps/web && npx tsx scripts/verify-pinecone.ts <realUid>
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const realUid = process.argv[2];
  const { upsertMemory, queryMemory, clearMemories } = await import('@/lib/pinecone');

  // 1. READ real memories
  if (realUid) {
    console.log(`── READ: querying real memories for ${realUid} ──`);
    const matches = await queryMemory(realUid, 'goals, work, priorities', 5);
    console.log(`  ${matches.length} match(es):`);
    for (const m of matches) {
      const text = String((m.metadata as { text?: string })?.text ?? '').slice(0, 90);
      console.log(`   · score ${m.score?.toFixed(3)}  "${text}…"`);
    }
    console.log('');
  }

  // 2. ROUND-TRIP under a throwaway id (never touches real data)
  const testUid = `__verify_probe_${Date.now()}`;
  const probe = 'MODUS pipeline verification probe: the verification passphrase is lavender-platypus-42.';
  console.log(`── ROUND-TRIP under ${testUid} ──`);
  console.log('  upserting probe memory…');
  await upsertMemory(testUid, probe, { source: 'verification' });

  // Pinecone is eventually consistent — poll until the probe is queryable.
  let found = null as null | { score?: number; metadata?: unknown };
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const matches = await queryMemory(testUid, 'what is the verification passphrase', 1);
    if (matches.length && matches[0].score && matches[0].score > 0.3) { found = matches[0]; break; }
    process.stdout.write(`  poll ${i + 1}… `);
  }
  console.log('');

  if (found) {
    const text = String((found.metadata as { text?: string })?.text ?? '');
    console.log(`  ✅ retrieved (score ${found.score?.toFixed(3)}): "${text.slice(0, 80)}…"`);
  } else {
    console.log('  ⛔ probe NOT retrieved within timeout — write or query path may be broken.');
  }

  console.log('  cleaning up probe…');
  await clearMemories(testUid);
  const after = await queryMemory(testUid, 'verification passphrase', 1);
  console.log(`  cleanup ${after.length === 0 ? '✅ done (0 left)' : `⚠️ ${after.length} left`}`);

  console.log('\n' + '─'.repeat(50));
  console.log(found ? 'PINECONE PIPELINE OK — embed + upsert + query + delete all work.' : 'PINECONE PIPELINE FAILED — see above.');
  process.exit(found ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
