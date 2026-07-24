/**
 * Reset a founding code back to `available` (clears status/claimedByUid/claimedAt)
 * so an abandoned/mis-claimed seat can be claimed again.
 *
 *   cd apps/web && npx tsx scripts/reset-founding-code.ts <password> [--force]
 *
 * SAFETY: refuses if the current claimant is on a PAID plan (that's a real
 * founder — resetting would let someone else take their seat number). Override
 * with --force only when you're sure (e.g. the claim was never paid).
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) });
const db = getFirestore();

async function main() {
  const pw = process.argv[2];
  const force = process.argv.includes('--force');
  if (!pw) { console.error('usage: npx tsx scripts/reset-founding-code.ts <password> [--force]'); process.exit(1); }

  const codeId = crypto.createHash('sha256').update(pw.trim()).digest('hex');
  const ref = db.collection('foundingCodes').doc(codeId);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`No founding code for ${JSON.stringify(pw)} (doc ${codeId.slice(0, 12)}…).`); process.exit(1); }
  const d = snap.data()!;
  console.log(`code #${d.foundingNumber} "${d.label}" — status=${d.status} claimedByUid=${d.claimedByUid ?? 'null'}`);

  if (d.status !== 'claimed') { console.log('Already available — nothing to do.'); process.exit(0); }

  // Guard: don't reset out from under a PAID founder unless forced.
  const uid = d.claimedByUid as string | undefined;
  if (uid) {
    const plan = (await db.collection('users').doc(uid).get()).data()?.plan as string | undefined;
    const paid = plan && plan !== 'free';
    console.log(`claimant users/${uid} plan=${plan ?? '(none)'}`);
    if (paid && !force) {
      console.error(`\n❌ Claimant is on a PAID plan (${plan}) — refusing. This looks like a real founder.\n   Re-run with --force only if you're certain the seat should be freed.`);
      process.exit(1);
    }
  }

  await ref.update({ status: 'available', claimedByUid: null, claimedAt: null });
  console.log(`\n✅ Reset #${d.foundingNumber} "${d.label}" → available. It can be claimed again.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
