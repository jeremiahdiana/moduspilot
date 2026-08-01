/**
 * Regression test for the abandoned-checkout bug: creating a founding checkout
 * session must NOT consume the seat. The seat is claimed only on payment success
 * (the Stripe webhook). So after POSTing /api/founding/checkout, the code must
 * still be `available`.
 *
 * Drives real prod: enter with a password → get the gate cookie → mint an ID
 * token for a FREE uid → POST /api/founding/checkout (creates a Stripe *session*,
 * NO charge, no subscription) → assert the code is STILL available.
 *
 *   cd apps/web && npx tsx scripts/smoke-prod-founding-no-claim.ts [password] [uid]
 *
 * Default password is a SYNTHETIC one this script seeds and deletes itself (the
 * old default, N1GTIS/JACKTIS #24, was a test code and has been removed).
 * Default uid = kahzatic (free). Leaves the
 * code available — safe to re-run. Never completes payment.
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

// Synthetic by default: seeded on entry, deleted on exit, so this never depends
// on a real founder's key still existing. Pass a real password to test that instead.
const PASSWORD = process.argv[2] || 'VERIFY-ONLY-no-claim-fixture';
const UID = process.argv[3] || 'fuzdgorHBoYuAZOaRrUKF60jFLF2'; // kahzatic (free)
const APP = process.env.MODUS_SMOKE_URL || 'https://app.moduspilot.com';

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) });
const db = getFirestore();

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

function gateCookie(res: Response): string | null {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? ''];
  for (const c of all) { const m = c.match(/(?:^|,\s*)founding_gate=([^;]+)/); if (m) return m[1]; }
  return null;
}

async function idToken(uid: string): Promise<string> {
  const custom = await getAuth().createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const data = await res.json() as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data.error)}`);
  return data.idToken;
}

async function main() {
  const codeId = crypto.createHash('sha256').update(PASSWORD.trim()).digest('hex');
  const ref = db.collection('foundingCodes').doc(codeId);

  console.log(`\n🧪 checkout-must-not-claim — pw ${JSON.stringify(PASSWORD)}, uid ${UID} → ${APP}\n`);

  const before = (await ref.get()).data() as { status?: string; label?: string } | undefined;
  if (!before) { console.log('❌ code does not exist — seed it first.'); process.exit(1); }
  console.log(`   code #? "${before.label}" status BEFORE = ${before.status}`);
  if (before.status !== 'available') {
    console.log(`⚠️  precondition: code is ${before.status}, not available. Reset it first (reset-founding-code.ts) — cannot test cleanly.`);
    process.exit(2);
  }

  // 1. gate cookie
  const enter = await fetch(`${APP}/api/founding/enter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
  if (enter.status === 429) { console.log('⚠️  rate-limited at /enter — wait ~10min.'); process.exit(2); }
  const cookie = gateCookie(enter);
  check('gate: entered, got founding_gate cookie', enter.status === 200 && !!cookie, `HTTP ${enter.status}`);
  if (!cookie) process.exit(1);

  // 2. token for the free uid
  const token = await idToken(UID);

  // 3. POST checkout — creates a Stripe SESSION only (no charge, no subscription)
  const co = await fetch(`${APP}/api/founding/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Cookie: `founding_gate=${cookie}` },
  });
  const cd = await co.json().catch(() => ({})) as { url?: string; error?: string; alreadyActive?: boolean };
  console.log(`\n   POST /api/founding/checkout → HTTP ${co.status}  ${JSON.stringify(cd).slice(0, 120)}`);
  check('checkout: returned a Stripe session url (200)', co.status === 200 && (!!cd.url || cd.alreadyActive === true), `status=${co.status}`);

  // 4. THE ASSERTION: the seat must still be available (not claimed by creating a session)
  const after = (await ref.get()).data() as { status?: string; claimedByUid?: string } | undefined;
  console.log(`   code status AFTER = ${after?.status} claimedByUid=${after?.claimedByUid ?? 'null'}`);
  check('🎯 seat NOT consumed by checkout (still available)', after?.status === 'available' && !after?.claimedByUid,
    after?.status === 'available' ? 'still available ✅' : `REGRESSION: became ${after?.status}`);

  console.log(`\n${failures === 0
    ? '✅ Abandoning checkout is now harmless — the session was created but the seat stayed available. The seat is only claimed on payment (webhook).'
    : `❌ ${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('\n❌ FATAL:', e); process.exit(1); });
