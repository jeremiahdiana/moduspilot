/**
 * Seed the 100 Founding Member codes from your private list.
 *
 * 1. Copy scripts/founding-codes.local.example.json to scripts/founding-codes.local.json
 *    (gitignored) and fill in one entry per person:
 *       { "label": "Mom", "foundingNumber": 1, "password": "whatever-you-pick" }
 * 2. Run:  cd apps/web && npx tsx scripts/seed-founding-codes.ts
 *
 * The Firestore doc id is sha256(password) — the plaintext is never stored. Your
 * local JSON is the only record of who has which key, so keep it. Re-running is
 * safe: it never clobbers a code that's already been claimed.
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

interface Entry { label: string; foundingNumber: number; password: string }

async function main() {
  const path = resolve(process.cwd(), 'scripts/founding-codes.local.json');
  let entries: Entry[];
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(`Could not read ${path}. Copy founding-codes.local.example.json to founding-codes.local.json and fill it in.`);
    process.exit(1);
  }

  // Guard against typos that would collide the doc id and silently drop people.
  const seenPw = new Set<string>();
  const seenNum = new Set<number>();
  for (const e of entries) {
    if (!e.password || !e.label || typeof e.foundingNumber !== 'number') {
      console.error('Every entry needs { label, foundingNumber, password }:', JSON.stringify(e));
      process.exit(1);
    }
    if (seenPw.has(e.password)) { console.error(`Duplicate password for "${e.label}" — each must be unique.`); process.exit(1); }
    if (seenNum.has(e.foundingNumber)) { console.error(`Duplicate foundingNumber ${e.foundingNumber} ("${e.label}").`); process.exit(1); }
    seenPw.add(e.password); seenNum.add(e.foundingNumber);
  }

  const { adminDb } = await import('@/lib/firebase-admin');
  const { FieldValue } = await import('firebase-admin/firestore');

  let wrote = 0, skipped = 0;
  for (const e of entries) {
    const codeId = crypto.createHash('sha256').update(e.password.trim()).digest('hex');
    const ref = adminDb.collection('foundingCodes').doc(codeId);
    const existing = (await ref.get()).data() as { status?: string } | undefined;
    if (existing?.status === 'claimed') {
      console.log(`skip  #${e.foundingNumber} ${e.label} — already claimed`);
      skipped++;
      continue;
    }
    await ref.set({
      label: e.label,
      foundingNumber: e.foundingNumber,
      status: 'available',
      claimedByUid: null,
      claimedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`seed  #${e.foundingNumber} ${e.label}`);
    wrote++;
  }

  console.log(`\nDone. ${wrote} seeded, ${skipped} left claimed. ${entries.length} total.`);
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
