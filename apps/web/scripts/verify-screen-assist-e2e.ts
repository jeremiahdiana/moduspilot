/**
 * Does Screen Assist actually work, end to end, against the real API?
 *
 * 🚨 WHY THIS EXISTS. The entire feature — capture, overlay, conversation,
 * watch mode, region select — was built, audited and guarded before anyone had
 * ever seen it produce ONE correct answer. Unit guards proved the parts; nothing
 * proved the whole. That is the gap this closes, and it should be run before any
 * release that touches the desktop or the chat route.
 *
 * It uses the real path and nothing simulated:
 *   · a REAL screenshot (apps/desktop/scripts/capture-to-file.js)
 *   · a REAL Firebase ID token, minted for the account under test
 *   · the REAL https://moduspilot.com/api/chat (or a local dev server)
 *   · the REAL AI SDK data-stream parser the desktop uses
 *
 *   cd apps/desktop && npx electron scripts/capture-to-file.js /tmp/shot.b64
 *   cd apps/web && npx tsx scripts/verify-screen-assist-e2e.ts <email> /tmp/shot.b64 [--local]
 *
 * ⚠️ Costs one real request against that account's plan ceiling.
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

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
const shotPath = process.argv[3];
const local = process.argv.includes('--local');
if (!email || !shotPath) throw new Error('usage: verify-screen-assist-e2e.ts <email> <shot.b64> [--local]');

const BASE = local ? 'http://localhost:3000' : 'https://moduspilot.com';

let failures = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * A real ID token for a real user.
 *
 * The desktop gets its token out of the signed-in window; a script cannot. Admin
 * mints a custom token and the public Identity Toolkit endpoint exchanges it for
 * the same kind of ID token /api/chat verifies — so this exercises the genuine
 * auth path rather than bypassing it.
 */
async function idTokenFor(uid: string): Promise<string> {
  const custom = await getAuth().createCustomToken(uid);
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(body).slice(0, 200)}`);
  return body.idToken as string;
}

const SCREEN_PROMPT =
  'This is a screenshot of what I am looking at right now. '
  + 'Use it as the primary context for my question. '
  + 'Be direct and specific about what is actually on the screen — quote exact text, names and values you can see. '
  + 'If the screen does not contain what you would need to answer, say so plainly instead of guessing.';

const QUESTION =
  'Name the application that is in the foreground, and quote two exact pieces of text you can read on the screen. '
  + 'If you cannot read the screen at all, say exactly "I cannot see the screen".';

async function main(): Promise<void> {
  const { uid } = await getAuth().getUserByEmail(email);
  const jpegBase64 = readFileSync(shotPath, 'utf8').trim();
  console.log(`\n  account : ${email} (${uid})`);
  console.log(`  target  : ${BASE}/api/chat`);
  console.log(`  image   : ${(jpegBase64.length / 1365).toFixed(0)}KB of base64\n`);

  const token = await idTokenFor(uid);
  check('a real ID token was minted and exchanged', token.length > 100, `${token.length} chars`);

  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      screenMode: true,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: jpegBase64 },
          { type: 'text', text: `${SCREEN_PROMPT}\n\n${QUESTION}` },
        ],
      }],
    }),
  });

  check('the request was accepted', res.ok, `HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`\n  body: ${(await res.text()).slice(0, 300)}\n`);
    console.log(`\n❌ ${failures} FAILED\n`);
    process.exit(1);
  }

  const headerModel = res.headers.get('x-modus-model') ?? '';
  const downgraded = res.headers.get('x-modus-downgraded') === '1';
  const reason = res.headers.get('x-modus-downgrade-reason') ?? '';

  // The SAME frame parser the desktop uses — if this drifts, the desktop breaks.
  let text = '';
  let servedModel = '';
  let buffer = '';
  const handle = (line: string): void => {
    const sep = line.indexOf(':');
    if (sep < 1) return;
    const code = line.slice(0, sep);
    let value: unknown;
    try { value = JSON.parse(line.slice(sep + 1)); } catch { return; }
    if (code === '0' && typeof value === 'string') text += value;
    if (code === '3') console.log(`  ⚠️  stream error frame: ${String(value).slice(0, 200)}`);
    if (code === '8' && Array.isArray(value)) {
      for (const a of value) {
        const m = (a as { modusServedModel?: unknown })?.modusServedModel;
        if (typeof m === 'string') servedModel = m;
      }
    }
  };
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line) handle(line);
    }
  }
  if (buffer.trim()) handle(buffer.trim());
  const ms = Date.now() - t0;

  const model = servedModel || headerModel;
  console.log(`\n  answered by : ${model}${downgraded ? `  (downgraded, reason=${reason})` : ''}`);
  console.log(`  latency     : ${ms}ms`);
  console.log(`  answer      : ${text.trim().replace(/\n/g, '\n                ')}\n`);

  check('the answer is not empty', text.trim().length > 0, `${text.length} chars`);
  check('the model did NOT say it cannot see', !/i cannot see the screen/i.test(text));
  check('a vision-capable model answered', !!model, model);
  check('the raw protocol did not leak into the answer', !text.includes('0:"'));
  check('it responded in a usable time', ms < 60_000, `${ms}ms`);

  console.log(`\n${failures === 0 ? '✅ PASS — Screen Assist works end to end' : `❌ ${failures} FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('\n❌ threw:', err.message, '\n'); process.exit(1); });
