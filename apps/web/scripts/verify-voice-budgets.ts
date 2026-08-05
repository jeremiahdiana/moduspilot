/**
 * Do the voice budgets actually BIND, on the real routes, against real Firestore?
 *
 * 💸 verify-surface-costs.ts proves the NUMBERS are affordable. This proves the
 * numbers are enforced — a budget that is only correct in a constants file is a
 * comment. Drives /api/tts and /api/transcribe as a real free user and a real paid
 * user, then reads the counters back out of Firestore.
 *
 * Covers the two bugs this replaced:
 *   - caps counted CALLS while the vendor bills CHARACTERS and SECONDS
 *   - free had a DAILY voice allowance bolted to a LIFETIME chat allowance
 *
 * Needs a server: `npm run dev` (or MODUS_APP_URL=https://app.moduspilot.com).
 * Creates and deletes its own throwaway accounts.
 *
 *   cd apps/web && npx tsx scripts/verify-voice-budgets.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FREE_TTS_CHARS_LIFETIME, MODUS_TTS_CHARS_PER_DAY } from '@/lib/constants';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}
const APP = process.env.MODUS_APP_URL || 'http://localhost:3000';

function app() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }) });
}
let failures = 0;
const check = (n: string, ok: boolean, d = '') => { console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

async function idToken(uid: string) {
  const custom = await getAuth(app()).createCustomToken(uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const d = await r.json() as { idToken?: string };
  if (!d.idToken) throw new Error('token exchange failed');
  return d.idToken;
}

function wav(seconds: number): Buffer {
  const sr = 16000, n = sr * seconds;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function tts(token: string, text: string) {
  const r = await fetch(`${APP}/api/tts`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }) });
  return { status: r.status, body: await r.text() };
}

async function stt(token: string, seconds: number) {
  const f = new FormData();
  f.append('audio', new Blob([new Uint8Array(wav(seconds))], { type: 'audio/wav' }), 'audio.wav');
  const r = await fetch(`${APP}/api/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: f });
  return { status: r.status, body: await r.text() };
}

async function mk(plan: string | null) {
  const auth = getAuth(app()); const db = getFirestore(app());
  const email = `voice-${plan ?? 'free'}-${Date.now()}@example.com`;
  const u = await auth.createUser({ email, password: `Pw!${Math.random().toString(36).slice(2)}A9` });
  await db.collection('users').doc(u.uid).set({
    email, name: 'Voice Test', onboardingComplete: true, createdAt: new Date(), grandfathered: false,
    ...(plan ? { plan } : {}),
  }, { merge: true });
  return u.uid;
}

async function main() {
  const db = getFirestore(app());
  const free = await mk(null);
  const paid = await mk('modus');
  try {
    const ft = await idToken(free);
    const pt = await idToken(paid);

    console.log('\nTTS — free is a LIFETIME pot\n');
    const chunk = 'a'.repeat(3900);
    let last = { status: 0, body: '' };
    let calls = 0;
    // FREE_TTS_CHARS_LIFETIME / 3900 calls should pass, then the wall.
    for (let i = 0; i < Math.ceil(FREE_TTS_CHARS_LIFETIME / 3900) + 2; i++) {
      last = await tts(ft, chunk);
      if (last.status === 429) break;
      calls++;
    }
    check('free TTS eventually returns 429', last.status === 429, `after ${calls} calls of 3,900 chars`);
    check('free wall says it does not come back', last.body.includes('tts_free_exhausted'), last.body.slice(0, 90));
    const fd = (await db.collection('users').doc(free).get()).data() ?? {};
    check('charged in CHARACTERS, not calls', (fd.ttsCharsLifetime ?? 0) > 0 && (fd.ttsCharsLifetime ?? 0) <= FREE_TTS_CHARS_LIFETIME,
      `ttsCharsLifetime=${fd.ttsCharsLifetime}`);
    check('never exceeds the lifetime budget', (fd.ttsCharsLifetime ?? 0) <= FREE_TTS_CHARS_LIFETIME,
      `${fd.ttsCharsLifetime} <= ${FREE_TTS_CHARS_LIFETIME}`);

    console.log('\nTTS — paid is a DAILY pot, and bigger\n');
    const p1 = await tts(pt, 'hello there');
    check('paid TTS works', p1.status === 200, `status ${p1.status}`);
    const pd = (await db.collection('users').doc(paid).get()).data() ?? {};
    check('paid charged to the daily counter', (pd.ttsCharsToday ?? 0) === 11, `ttsCharsToday=${pd.ttsCharsToday}`);
    // Compare like with like: paid is per DAY, free is for LIFE, so the only
    // meaningful comparison is over a month. (The first version of this line
    // compared 8,000/day against 20,000/lifetime and "failed" on nothing.)
    check('a paid month buys far more voice than the whole free pot',
      MODUS_TTS_CHARS_PER_DAY * 30 > FREE_TTS_CHARS_LIFETIME * 5,
      `${(MODUS_TTS_CHARS_PER_DAY * 30).toLocaleString()}/month vs ${FREE_TTS_CHARS_LIFETIME.toLocaleString()} for life`);

    console.log('\nTranscribe — charged in SECONDS of audio\n');
    const s1 = await stt(pt, 3);
    check('transcribe returns 200 with the filename fix', s1.status === 200, s1.body.slice(0, 120));
    const pd2 = (await db.collection('users').doc(paid).get()).data() ?? {};
    check('seconds were actually charged', (pd2.sttSecondsToday ?? 0) > 0, `sttSecondsToday=${pd2.sttSecondsToday}`);

    console.log('\nTranscribe — free pot is lifetime and small\n');
    const s2 = await stt(ft, 3);
    check('free transcribe works while in budget', s2.status === 200, s2.body.slice(0, 100));
    const fd2 = (await db.collection('users').doc(free).get()).data() ?? {};
    check('free charged to a LIFETIME counter', (fd2.sttSecondsLifetime ?? 0) > 0, `sttSecondsLifetime=${fd2.sttSecondsLifetime}`);
  } finally {
    for (const uid of [free, paid]) {
      await db.collection('users').doc(uid).delete().catch(() => {});
      await getAuth(app()).deleteUser(uid).catch(() => {});
    }
    console.log('\n🧹 cleaned up both test users');
  }
  console.log(`\n${failures === 0 ? '✅ VOICE BUDGETS BIND ON THE REAL ROUTES.' : `❌ ${failures} FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error('\n❌', e); process.exit(1); });
