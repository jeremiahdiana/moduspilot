/**
 * Drive the REAL production approval-card flow end to end, both halves:
 *   1. EMIT  — POST /api/chat "add a task to …" → the model must return a
 *              well-formed ```approval fenced block the client can parse
 *   2. EXECUTE— POST that card to /api/approval → the action really happens
 *              (task lands in Firestore), then we CLEAN IT UP
 *
 * The emit half is the untested one. A handler that works is useless if the model
 * never produces a card the client's parser (MessageBubble.tsx:
 * /```(approval|…)\n([\s\S]*?)```/) can read. So this asserts the exact fence, not
 * just that some JSON came back.
 *
 * DELIBERATELY create_task only — a Firestore write, fully reversible. This script
 * must NEVER exercise send_email / schedule_event / draft_email: those touch the
 * owner's real Gmail and Calendar and are not ours to fire from a smoke test.
 *
 *   cd apps/web && npx tsx scripts/smoke-prod-approval.ts [uid]
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

const UID = process.argv[2] || 'hSBcOHKSX9eCHaKSDczccTRzv093';
const APP = 'https://app.moduspilot.com';
// A distinctive title so we find (and only delete) the exact doc we created.
const MARK = `SMOKE-${Date.now().toString(36).toUpperCase()}`;

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

// The exact regex MessageBubble.tsx uses to turn the stream into a card.
const FENCE = /```(approval|draft_options|options|image|document|chart)\n([\s\S]*?)```/g;

async function main() {
  const token = await idToken();
  console.log(`\n✅ real Firebase ID token (uid ${UID})`);

  // ── Half 1: emit ──
  const ask = `Add a task titled "${MARK} call the dentist" for tomorrow. Just create it.`;
  console.log(`\n── half 1: EMIT — POST ${APP}/api/chat ──\n   ask: ${JSON.stringify(ask)}`);
  const cr = await fetch(`${APP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ id: 'appr-1', role: 'user', content: ask, parts: [{ type: 'text', text: ask }] }],
      modelChoice: 'default',
    }),
  });
  const raw = await cr.text();
  let assistant = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^0:(".*")$/);
    if (m) { try { assistant += JSON.parse(m[1]); } catch { /* partial */ } }
  }
  console.log(`   HTTP ${cr.status}  x-modus-model: ${cr.headers.get('x-modus-model') ?? '(none)'}`);

  FENCE.lastIndex = 0;
  const match = FENCE.exec(assistant);
  if (!match || match[1] !== 'approval') {
    console.log(`❌ no parseable \`\`\`approval block in the reply.`);
    console.log(`   reply was: ${JSON.stringify(assistant.slice(0, 300))}`);
    process.exit(1);
  }
  let card: { type?: string; title?: string; description?: string; payload?: Record<string, unknown> };
  try { card = JSON.parse(match[2].trim()); }
  catch (e) { console.log(`❌ approval block is not valid JSON: ${e}`); console.log(match[2]); process.exit(1); }
  console.log(`✅ emitted a parseable approval card`);
  console.log(`   type=${card.type}  title=${JSON.stringify(card.title)}  payload=${JSON.stringify(card.payload)}`);
  if (card.type !== 'create_task') {
    console.log(`⚠️  expected create_task, got ${card.type} — refusing to execute a non-Firestore card in a smoke test.`);
    process.exit(1);
  }

  // ── Half 2: execute ──
  console.log(`\n── half 2: EXECUTE — POST ${APP}/api/approval ──`);
  const ar = await fetch(`${APP}/api/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: card.type, title: card.title, description: card.description ?? '', payload: card.payload ?? {} }),
  });
  const ad = await ar.json() as { id?: string; error?: string };
  console.log(`   HTTP ${ar.status}  ${JSON.stringify(ad)}`);
  if (!ar.ok || !ad.id) { console.log('❌ approval execution failed'); process.exit(1); }

  // ── Verify the doc really landed, then clean up ──
  const db = getFirestore(app());
  const ref = db.collection('users').doc(UID).collection('tasks').doc(ad.id);
  const snap = await ref.get();
  const landed = snap.exists && String((snap.data()?.title ?? '')).includes(MARK);
  console.log(`\n   Firestore doc ${ad.id}: ${landed ? '✅ exists with our title' : '❌ missing or wrong title'}`);
  if (snap.exists) {
    await ref.delete();
    console.log(`   🧹 cleaned up (hard-deleted the smoke task)`);
  }

  const ok = landed;
  console.log(`\n${ok ? '✅ APPROVAL CARDS WORK — model emitted a parseable card, /api/approval executed it, the task landed on prod.' : '❌ approval flow broken — see above.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
