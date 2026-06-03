/**
 * One-off: fix a user's briefingTimezone so the hourly proactive crons run
 * during their actual day. Reports before/after.
 *
 *   cd apps/web && npx tsx scripts/set-timezone.ts <uid> <IANA-tz>
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
  const tz = process.argv[3];
  if (!uid || !tz) { console.error('usage: set-timezone.ts <uid> <IANA-tz>'); process.exit(1); }

  const { adminDb } = await import('@/lib/firebase-admin');
  const ref = adminDb.collection('users').doc(uid);
  const before = (await ref.get()).data()?.settings?.briefingTimezone ?? '(unset)';
  console.log(`before: briefingTimezone = ${before}`);

  await ref.set({ settings: { briefingTimezone: tz } }, { merge: true });

  const after = (await ref.get()).data()?.settings?.briefingTimezone ?? '(unset)';
  console.log(`after:  briefingTimezone = ${after}`);
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
