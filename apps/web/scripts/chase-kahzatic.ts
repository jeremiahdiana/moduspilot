/**
 * Six Stripe checkout sessions from kahzatic@gmail.com (2026-07-13/14) carry
 * six different uids, none of which appear in listUsers(). Do those accounts
 * exist? Read-only.
 *
 *   cd apps/web && npx tsx scripts/chase-kahzatic.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

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

const UIDS = [
  'p9fZPGDw8zQbZQSj0AgRxP0outH3',
  '2M4gxdQ1zCfoZrqvyzGLu79fY9h2',
  '5ZvexD0jA8TCVFOjN2BDest4lXh2',
  'OK1tN3hDy0WXzCEwcWs5rsSc9WP2',
  'EPmDV0WkgtPP0Z9bl82jcJFVgPG2',
  'zDrZt7AJ40Uhu5ILDwLGP5OJaiy1',
  'QdR9sYojEXPZtXw0pmdFlLJ5bwf1', // May 17, jeremiahmaximojr@gmail.com
];

async function main() {
  const auth = getAuth(app());
  const fs = getFirestore(app());

  for (const uid of UIDS) {
    let authLine = 'NOT IN AUTH';
    try {
      const u = await auth.getUser(uid);
      authLine = `${u.email ?? '(no email)'}  providers=${u.providerData.map((p) => p.providerId).join(',') || 'none'}  anon=${u.providerData.length === 0}  created=${u.metadata.creationTime}`;
    } catch (e: unknown) {
      authLine = `NOT IN AUTH (${(e as { code?: string }).code ?? 'unknown'})`;
    }

    const snap = await fs.collection('users').doc(uid).get();
    const doc = snap.exists ? JSON.stringify(snap.data()).slice(0, 160) : 'no user doc';

    console.log(`${uid}`);
    console.log(`   auth: ${authLine}`);
    console.log(`   doc : ${doc}`);
    console.log();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
