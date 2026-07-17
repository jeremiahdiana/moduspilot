/**
 * What actually happens to a stranger who signs up for MODUS today?
 *
 * Nobody but the founder has ever done this, so it has never been observed.
 * Creates a throwaway Firebase account, drives the REAL production endpoints as
 * that account, and DELETES it at the end (finally block — it cleans up even on
 * failure). Compares against a signed-out guest hitting the same endpoint.
 *
 *   cd apps/web && npx tsx scripts/stranger-walkthrough.ts
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

const APP = 'https://app.moduspilot.com';

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

async function idTokenFor(uid: string): Promise<string> {
  const custom = await getAuth(app()).createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const d = await res.json() as { idToken?: string; error?: unknown };
  if (!d.idToken) throw new Error(`exchange failed: ${JSON.stringify(d.error)}`);
  return d.idToken;
}

function chatBody() {
  const text = 'Say hi in one short sentence.';
  return JSON.stringify({
    messages: [{ id: 's1', role: 'user', content: text, parts: [{ type: 'text', text }] }],
    modelChoice: 'default',
  });
}

async function main() {
  const auth = getAuth(app());
  const fs = getFirestore(app());
  const email = `stranger-test-${Date.now()}@example.com`;
  let uid = '';

  try {
    // ── Step 1: sign up, exactly like a new Google user landing today ──
    const user = await auth.createUser({ email, displayName: 'Stranger Test' });
    uid = user.uid;
    console.log(`\n1. SIGNED UP  ${email}\n   uid=${uid}\n`);

    // ── Step 2: finish onboarding (what the onboarding page writes) ──
    await fs.collection('users').doc(uid).set({
      displayName: 'Stranger Test',
      onboardingComplete: true,
      onboardingAnswers: { role: 'Professional' },
      settings: {
        personalContext: 'My name is Stranger Test. I am a Professional.',
        responseStyle: 'normal',
        capabilities: { voiceInput: false, vectorMemory: true },
        generateMemoryFromChat: true,
        helpImprove: false,
        dataRetention: true,
        customStyle: '',
      },
    }, { merge: true });
    console.log('2. FINISHED ONBOARDING  (plan is unset => free, no subscription)\n');

    // ── Step 3: try to send the very first message ──
    const token = await idTokenFor(uid);
    const res = await fetch(`${APP}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: chatBody(),
    });
    const body = await res.text();
    console.log(`3. SENT THEIR FIRST MESSAGE  ->  HTTP ${res.status}`);
    console.log(`   ${body.slice(0, 200)}\n`);

    // ── Step 4: the same request, signed out (a guest) ──
    const guest = await fetch(`${APP}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody(),
    });
    const graw = await guest.text();
    let ganswer = '';
    for (const line of graw.split('\n')) {
      const m = line.match(/^0:(".*")$/);
      if (m) { try { ganswer += JSON.parse(m[1]); } catch { /* partial */ } }
    }
    console.log(`4. THE SAME REQUEST, SIGNED OUT (guest)  ->  HTTP ${guest.status}`);
    console.log(`   ${ganswer ? `answered: ${JSON.stringify(ganswer.trim().slice(0, 80))}` : graw.slice(0, 160)}\n`);

    console.log('─'.repeat(64));
    const signedUpBlocked = res.status !== 200;
    const guestWorks = guest.status === 200 && ganswer.length > 0;
    if (signedUpBlocked && guestWorks) {
      console.log('VERDICT: signing up is a STRICT DOWNGRADE.');
      console.log(`  signed out  -> ${guest.status}, gets an answer (GUEST_DAILY_LIMIT=5/day)`);
      console.log(`  signed up   -> ${res.status}, gets nothing until a card is entered`);
    } else if (!signedUpBlocked) {
      console.log('VERDICT: a new signup CAN chat. The paywall did not block them.');
    } else {
      console.log(`VERDICT: signed-up=${res.status}, guest=${guest.status} — read the output above.`);
    }
  } finally {
    if (uid) {
      await fs.recursiveDelete(fs.doc(`users/${uid}`)).catch(() => {});
      await getAuth(app()).deleteUser(uid).catch(() => {});
      console.log(`\n🧹 cleaned up test account ${uid}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌', e); process.exit(1); });
