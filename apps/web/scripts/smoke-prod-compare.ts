/**
 * Drive the REAL production compare endpoint — every catalog model, one column
 * at a time, exactly as the client fires them — then the verdict.
 *
 * Compare mode is the multi-model differentiator and the thing an affiliate demo
 * rests on, and it had never been driven end to end. It also has its OWN
 * streamText call: it inherits nothing from /api/chat, so a constraint fixed
 * there is not fixed here.
 *
 * A dead column in compare mode does not read as an error. It reads as
 * "that model lost".
 *
 *   cd apps/web && npx tsx scripts/smoke-prod-compare.ts [uid]
 *   cd apps/web && npx tsx scripts/smoke-prod-compare.ts --model claude-opus-4-8
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

import { PLATFORM_MODELS } from '../lib/models';

const argUid = process.argv.find((a, i) => i >= 2 && !a.startsWith('--') && process.argv[i - 1] !== '--model');
const UID = argUid || 'hSBcOHKSX9eCHaKSDczccTRzv093';
const APP = 'https://app.moduspilot.com';
const only = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : null;

const PROMPT = 'In two sentences, what is the single biggest risk of relying on one AI model?';

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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const data = await res.json() as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data.error)}`);
  return data.idToken;
}

async function column(token: string, modelId: string) {
  const started = Date.now();
  const res = await fetch(`${APP}/api/chat/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: PROMPT, model: modelId }),
  });
  const served = res.headers.get('x-modus-model') ?? '(none)';
  if (!res.ok) {
    return { modelId, ok: false, status: res.status, served, ms: Date.now() - started, text: '', detail: (await res.text()).slice(0, 200) };
  }
  // toTextStreamResponse() — the body is the raw answer, no frame protocol.
  const text = await res.text();
  return { modelId, ok: text.trim().length > 0, status: res.status, served, ms: Date.now() - started, text, detail: '' };
}

async function main() {
  const token = await idToken();
  console.log(`\n✅ real Firebase ID token (uid ${UID})`);
  console.log(`POST ${APP}/api/chat/compare\nprompt: ${JSON.stringify(PROMPT)}\n`);

  const models = only ? [only] : PLATFORM_MODELS.map(m => m.id);
  const results: Awaited<ReturnType<typeof column>>[] = [];

  for (const id of models) {
    const r = await column(token, id);
    results.push(r);
    const flag = r.ok ? '✅' : '❌';
    console.log(`${flag} ${id.padEnd(24)} HTTP ${r.status}  served=${r.served.padEnd(22)} ${String(r.ms).padStart(6)}ms  ${String(r.text.length).padStart(5)} chars`);
    if (!r.ok && r.detail) console.log(`     ↳ ${r.detail}`);
    else if (r.ok) console.log(`     ↳ ${JSON.stringify(r.text.slice(0, 100))}`);
  }

  // The verdict runs once all columns finish — feed it the real answers.
  const answers = results.filter(r => r.ok).slice(0, 3).map(r => ({ model: r.modelId, text: r.text, ms: r.ms }));
  if (answers.length >= 2) {
    const vr = await fetch(`${APP}/api/chat/compare/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: PROMPT, answers }),
    });
    const vd = await vr.json() as { verdict?: string | null };
    console.log(`\n── verdict (HTTP ${vr.status}) ──`);
    console.log(vd.verdict ? `✅ ${vd.verdict}` : '❌ null verdict — the differentiator produced nothing');
  } else {
    console.log('\n⏭️  fewer than 2 live columns, verdict not exercised');
  }

  const dead = results.filter(r => !r.ok);
  console.log(`\n${dead.length === 0 ? '✅ every column answered' : `❌ ${dead.length} dead column(s): ${dead.map(d => d.modelId).join(', ')}`}`);
  process.exit(dead.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
