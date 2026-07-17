/**
 * List Firebase Auth accounts: email, provider, created, last sign-in.
 * Read-only. The user docs mostly lack `email`, so identity lives here.
 * (lib/firebase-admin's adminAuth wrapper exposes no listUsers, so init here.)
 *
 *   cd apps/web && npx tsx scripts/accounts-auth.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

async function main() {
  const res = await getAuth(app()).listUsers(1000);
  console.log(`\n=== ${res.users.length} Firebase Auth accounts ===\n`);
  const rows = res.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? '—',
    providers: u.providerData.map((p) => p.providerId).join(',') || '—',
    created: u.metadata.creationTime,
    lastSignIn: u.metadata.lastSignInTime,
  }));
  rows.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  for (const r of rows) {
    console.log(`${r.email}   ${r.uid}`);
    console.log(`   via=${r.providers}`);
    console.log(`   created=${r.created}`);
    console.log(`   lastSignIn=${r.lastSignIn}`);
    console.log();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
