/**
 * Smoke-test the REAL production chat endpoint end to end.
 *
 * /api/chat needs a genuine Firebase ID token, which is why prod chat had never
 * been driven after a deploy. It can be: mint a custom token with the Admin SDK,
 * exchange it for an ID token via the Identity Toolkit REST API, then POST to
 * app.moduspilot.com like the browser does (useChat sends `parts`, so send that
 * shape — a Core-only body would not exercise the real path).
 *
 *   cd apps/web && npx tsx scripts/smoke-prod-chat.ts [uid]
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

const UID = process.argv[2] || 'hSBcOHKSX9eCHaKSDczccTRzv093'; // jeremiahmaximojr@gmail.com
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

async function idToken(): Promise<string> {
  const custom = await getAuth(app()).createCustomToken(UID);
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const data = await res.json() as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data.error)}`);
  return data.idToken;
}

async function main() {
  console.log(`\nPOST ${APP}/api/chat  (uid ${UID})\n`);
  const token = await idToken();
  console.log('✅ minted a real Firebase ID token\n');

  // --big sends a request over the old LLAMA_TPM_SAFE_TOKENS=9000 threshold. On a
  // PAID account that used to silently upgrade Llama -> gpt-5.6-terra, i.e. spend
  // money. After 233b95f it must stay on Llama: x-modus-model is the proof.
  const big = process.argv.includes('--big');
  const filler = big
    ? 'The quarterly review covered revenue, retention, and roadmap risk in detail. '.repeat(700)
    : '';
  const text = big
    ? `${filler}\n\nIgnore the text above. Reply with exactly one short sentence confirming you are working. Nothing else.`
    : 'Reply with exactly one short sentence confirming you are working. Nothing else.';
  if (big) console.log(`sending ~${Math.ceil(text.length / 4).toLocaleString()} estimated tokens (old guard tripped above 9,000)\n`);
  const started = Date.now();
  const res = await fetch(`${APP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // The browser shape: useChat always sends `parts` alongside `content`.
    body: JSON.stringify({
      messages: [{ id: 'smoke-1', role: 'user', content: text, parts: [{ type: 'text', text }] }],
      modelChoice: 'default',
    }),
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  console.log(`x-modus-model: ${res.headers.get('x-modus-model') ?? '(none)'}`);
  if (!res.ok) {
    console.log(`\n❌ body: ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }

  // Data stream protocol: 0:"token" frames are the assistant's text.
  const raw = await res.text();
  let answer = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^0:(".*")$/);
    if (m) { try { answer += JSON.parse(m[1]); } catch { /* partial */ } }
  }
  const ann = raw.split('\n').filter((l) => l.startsWith('8:'));

  console.log(`\nstreamed in ${Date.now() - started}ms, ${raw.length} bytes`);
  console.log(`answer: ${JSON.stringify(answer.trim())}`);
  if (ann.length) console.log(`annotations: ${ann.join(' ').slice(0, 200)}`);

  if (answer.trim().length > 0) {
    console.log('\n✅ PROD CHAT WORKS — a real token in, a real answer out, on the live deployment.');
  } else {
    console.log('\n❌ 200 but EMPTY answer — the blank-bubble failure. Investigate.');
    process.exit(1);
  }
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
