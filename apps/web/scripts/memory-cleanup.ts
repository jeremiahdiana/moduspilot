/**
 * One-time cleanup of polluted vector memories. The old chat route stored raw
 * exchanges as type 'user_message' / 'assistant_response' (the junk). User-
 * curated ('manual_memory'), imported ('imported_memory'), and the new
 * 'extracted_fact' memories are kept.
 *
 * Report (default):  cd apps/web && npx tsx scripts/memory-cleanup.ts <uid>
 * Delete junk:       cd apps/web && npx tsx scripts/memory-cleanup.ts <uid> --delete
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

const JUNK_TYPES = new Set(['user_message', 'assistant_response']);

async function main() {
  const uid = process.argv[2];
  const doDelete = process.argv.includes('--delete');
  if (!uid) { console.error('usage: memory-cleanup.ts <uid> [--delete]'); process.exit(1); }

  const { Pinecone } = await import('@pinecone-database/pinecone');
  const { MEMORY_INDEX } = await import('@/lib/pinecone');
  const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }).index(MEMORY_INDEX);

  // 1. List all of the user's vector IDs (id prefix `${uid}-`).
  const allIds: string[] = [];
  let token: string | undefined;
  do {
    const page = await index.listPaginated({ prefix: `${uid}-`, limit: 100, ...(token ? { paginationToken: token } : {}) });
    allIds.push(...(page.vectors ?? []).map(v => v.id).filter(Boolean) as string[]);
    token = page.pagination?.next;
  } while (token);

  console.log(`Total memories for ${uid}: ${allIds.length}\n`);
  if (!allIds.length) { console.log('Nothing to do.'); process.exit(0); }

  // 2. Fetch metadata in batches to classify by type.
  const byType: Record<string, number> = {};
  const junkIds: string[] = [];
  const junkSamples: string[] = [];
  for (let i = 0; i < allIds.length; i += 100) {
    const batch = allIds.slice(i, i + 100);
    const res = await index.fetch(batch);
    for (const [id, rec] of Object.entries(res.records ?? {})) {
      const type = String((rec.metadata as { type?: string })?.type ?? 'unknown');
      byType[type] = (byType[type] ?? 0) + 1;
      if (JUNK_TYPES.has(type)) {
        junkIds.push(id);
        if (junkSamples.length < 6) junkSamples.push(String((rec.metadata as { text?: string })?.text ?? '').slice(0, 80));
      }
    }
  }

  console.log('By type:');
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${JUNK_TYPES.has(t) ? '🗑 ' : '✅ '}${t}: ${n}`);
  }
  console.log(`\nJunk to remove: ${junkIds.length}  |  keeping: ${allIds.length - junkIds.length}`);
  console.log('Junk samples:');
  for (const s of junkSamples) console.log(`   · "${s}…"`);

  if (!doDelete) {
    console.log('\n(report only — re-run with --delete to remove the junk)');
    process.exit(0);
  }

  if (junkIds.length) {
    for (let i = 0; i < junkIds.length; i += 100) {
      await index.deleteMany(junkIds.slice(i, i + 100));
    }
  }
  console.log(`\n✅ Deleted ${junkIds.length} junk memories. Kept ${allIds.length - junkIds.length}.`);
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
