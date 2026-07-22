/**
 * TEMP diagnostic: reproduce the blank-bubble failure on a chosen model and
 * print WHY, using the data-stream frames the browser already receives.
 *
 * The route logs no finishReason, so the server cannot tell an empty answer from
 * a good one. But the stream itself carries it: `e:`/`d:` frames hold
 * finishReason + usage, `3:` holds the sanitized error token, `9:`/`a:` hold
 * tool calls/results. Decoding them needs no deploy and no new logging.
 *
 *   cd apps/web && npx tsx scripts/tmp-repro-sonnet5.ts <model> "<prompt>"
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

const UID = 'hSBcOHKSX9eCHaKSDczccTRzv093';
// MODUS_APP_URL points this at a preview deployment, so a fix can be proven
// before it reaches production.
const APP = process.env.MODUS_APP_URL || 'https://app.moduspilot.com';
const MODEL = process.argv[2] || 'claude-sonnet-5';
const PROMPT = process.argv[3] || 'Reply with exactly one short sentence confirming you are working. Nothing else.';

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
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
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
  console.log(`\n── modelChoice=${MODEL} ──`);
  console.log(`prompt: ${JSON.stringify(PROMPT)}`);
  const token = await idToken();

  const started = Date.now();
  const res = await fetch(`${APP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      // --multi reproduces the failing SHAPE from the 19:21:57 log: a second user
      // turn on top of an existing exchange, not a fresh single message.
      messages: process.argv.includes('--multi')
        ? [
            { id: 'r1', role: 'user', content: 'hey', parts: [{ type: 'text', text: 'hey' }] },
            { id: 'r2', role: 'assistant', content: "Hey Jeremiah. What's on your mind?", parts: [{ type: 'text', text: "Hey Jeremiah. What's on your mind?" }] },
            { id: 'r3', role: 'user', content: PROMPT, parts: [{ type: 'text', text: PROMPT }] },
          ]
        : [{ id: 'repro-1', role: 'user', content: PROMPT, parts: [{ type: 'text', text: PROMPT }] }],
      modelChoice: MODEL,
      personalContext: '',
      responseStyle: 'normal',
      briefingHour: 7,
      briefingTimezone: 'Australia/Sydney',
    }),
  });

  console.log(`HTTP ${res.status}  x-modus-model: ${res.headers.get('x-modus-model') ?? '(none)'}`);
  if (!res.ok) { console.log(`body: ${(await res.text()).slice(0, 400)}`); process.exit(1); }

  const raw = await res.text();
  let answer = '';
  const other: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const t = line.match(/^0:(".*")$/);
    if (t) { try { answer += JSON.parse(t[1]); } catch { /* partial */ } continue; }
    other.push(line);
  }

  console.log(`\nelapsed ${Date.now() - started}ms, ${raw.length} bytes, answer ${answer.trim().length} chars`);
  console.log(`answer: ${JSON.stringify(answer.trim().slice(0, 300))}`);
  console.log(`\n── non-text frames (finishReason lives here) ──`);
  for (const l of other) console.log(`  ${l.slice(0, 400)}`);

  console.log(
    answer.trim().length > 0
      ? '\n✅ real answer'
      : '\n❌ REPRODUCED: 200 with an EMPTY answer — the blank bubble.',
  );
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
