/**
 * Read or set a user's plan directly in Firestore (owner/admin use).
 *
 * `plan` is normally written by the Stripe webhook. Setting it by hand grants
 * entitlement WITHOUT a subscription, so it is reversible on purpose: the script
 * always prints the previous value before writing, and records it under
 * `planBeforeManualOverride` so the account can be put back exactly as it was.
 *
 * ⚠️ A future Stripe webhook for this customer will overwrite whatever is set
 * here — this is a local entitlement override, not a billing change.
 *
 *   cd apps/web && npx tsx scripts/set-plan.ts                 # read
 *   cd apps/web && npx tsx scripts/set-plan.ts pilot           # set
 *   cd apps/web && npx tsx scripts/set-plan.ts --restore       # put it back
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const UID = process.env.MODUS_UID || 'hSBcOHKSX9eCHaKSDczccTRzv093';

function app() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function main() {
  const db = getFirestore(app());
  db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  const ref = db.collection('users').doc(UID);
  const snap = await ref.get();
  const data = snap.data() ?? {};

  console.log(`uid            : ${UID}`);
  console.log(`plan           : ${data.plan ?? '(none)'}`);
  console.log(`grandfathered  : ${data.grandfathered ?? '(unset)'}`);
  console.log(`saved model    : ${JSON.stringify(data.settings?.modelSettings ?? null)}`);
  if (data.planBeforeManualOverride !== undefined) {
    console.log(`⚠️  previously overridden from: ${data.planBeforeManualOverride}`);
  }

  const arg = process.argv[2];
  if (!arg) return;

  if (arg === '--restore') {
    const prev = data.planBeforeManualOverride;
    if (prev === undefined) { console.log('\nnothing to restore — no manual override recorded'); return; }
    await ref.set({ plan: prev, planBeforeManualOverride: null }, { merge: true });
    console.log(`\n✅ restored plan → ${prev}`);
    return;
  }

  if (!['free', 'modus', 'pilot', 'group'].includes(arg)) {
    console.error(`\n❌ not a valid plan: ${arg}`);
    process.exit(1);
  }
  if (data.plan === arg) { console.log(`\nalready ${arg} — nothing to do`); return; }

  await ref.set(
    {
      plan: arg,
      // Only record the ORIGINAL on the first override, so repeated runs can't
      // lose the real value behind an intermediate one.
      ...(data.planBeforeManualOverride === undefined || data.planBeforeManualOverride === null
        ? { planBeforeManualOverride: data.plan ?? 'free' }
        : {}),
    },
    { merge: true },
  );
  console.log(`\n✅ plan ${data.plan ?? '(none)'} → ${arg}   (restore with: npx tsx scripts/set-plan.ts --restore)`);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
