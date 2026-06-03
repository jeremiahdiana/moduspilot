/**
 * List a user's habits (id, title, streak, #completions, last completion,
 * created) to spot duplicates. With `--remove <habitId>` it deletes one.
 *
 *   cd apps/web && npx tsx scripts/habits-inspect.ts <uid>
 *   cd apps/web && npx tsx scripts/habits-inspect.ts <uid> --remove <habitId>
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

async function main() {
  const uid = process.argv[2];
  const removeFlag = process.argv.indexOf('--remove');
  const removeId = removeFlag !== -1 ? process.argv[removeFlag + 1] : null;
  if (!uid) { console.error('usage: habits-inspect.ts <uid> [--remove <habitId>]'); process.exit(1); }

  const { adminDb } = await import('@/lib/firebase-admin');
  const col = adminDb.collection('users').doc(uid).collection('habits');

  if (removeId) {
    const snap = await col.doc(removeId).get();
    if (!snap.exists) { console.error(`habit ${removeId} not found`); process.exit(1); }
    console.log(`Deleting habit ${removeId}: "${snap.data()?.title}" (streak ${snap.data()?.streak ?? 0}, ${((snap.data()?.completedDates ?? []) as string[]).length} completions)`);
    await col.doc(removeId).delete();
    console.log('Deleted.');
    process.exit(0);
  }

  const snap = await col.get();
  console.log(`${snap.size} habit(s):\n`);
  for (const d of snap.docs) {
    const h = d.data();
    const dates = (h.completedDates ?? []) as string[];
    const created = h.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) ?? '?';
    console.log(`  id=${d.id}`);
    console.log(`     title="${h.title}"  streak=${h.streak ?? 0}  completions=${dates.length}  last=${dates.slice(-1)[0] ?? 'never'}  created=${created}  deleted=${h.deleted ?? false}`);
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
