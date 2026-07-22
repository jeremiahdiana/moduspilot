/**
 * What is actually stored in memory, and what does a real query score against it?
 *
 * queryMemoryContext keeps only matches with score > 0.55. Measured scores on the
 * live index were 0.086–0.175, i.e. the filter discards everything — memory is
 * never injected into a prompt even when retrieval succeeds. This prints the
 * stored facts alongside the scores a natural question produces, so the threshold
 * can be set from data instead of intuition.
 *
 *   cd apps/web && npx tsx scripts/inspect-memory.ts
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

  const probes = [
    'where do I live',
    'what am I working on',
    'tell me about MODUS',
    'what is my startup',
    'am I raising money',
  ];

  for (const q of probes) {
    const matches = await queryMemory(UID, q, 5) as { score?: number; metadata?: { text?: string } }[];
    console.log(`\n── ${JSON.stringify(q)}`);
    if (matches.length === 0) { console.log('   (no matches at all)'); continue; }
    for (const m of matches) {
      const passes = (m.score ?? 0) > 0.55 ? 'KEPT   ' : 'dropped';
      console.log(`   ${passes} ${(m.score ?? 0).toFixed(3)}  ${String(m.metadata?.text ?? '').slice(0, 90)}`);
    }
  }

  const all = await queryMemory(UID, 'Jeremiah', 20) as { score?: number }[];
  const scores = all.map(m => m.score ?? 0);
  console.log(`\ntotal vectors reachable: ${all.length}`);
  if (scores.length) {
    console.log(`score range: ${Math.min(...scores).toFixed(3)} … ${Math.max(...scores).toFixed(3)}`);
    console.log(`the 0.55 filter would keep: ${scores.filter(s => s > 0.55).length}/${scores.length}`);
  }
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
