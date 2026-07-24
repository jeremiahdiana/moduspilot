/**
 * Drive the REAL production attachment path end to end, both legs:
 *   1. POST a real PDF to /api/attachments/extract  → text comes back
 *   2. POST that text as `attachments[]` to /api/chat → the model quotes a fact
 *      that appears ONLY in the file
 *
 * The second leg is the one that matters. Extraction returning text proves unpdf
 * works; it does NOT prove the text reaches the model. The PDF carries a phrase
 * the model cannot know any other way — if it comes back in the answer, the whole
 * pipeline (extract → attachments[] → ATTACHED FILES system block → model) is real.
 *
 *   cd apps/web && npx tsx scripts/smoke-prod-attachment.ts /tmp/modus-attach-test.pdf [uid]
 */
import { readFileSync } from 'fs';
import { resolve, basename } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const PDF = process.argv[2] || '/tmp/modus-attach-test.pdf';
const UID = process.argv[3] || 'hSBcOHKSX9eCHaKSDczccTRzv093';
const APP = 'https://app.moduspilot.com';
const SECRET = 'VELVET-ANTLER-9317'; // present ONLY in the PDF

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

async function main() {
  const token = await idToken();
  console.log(`\n✅ real Firebase ID token (uid ${UID})`);

  // ── Leg 1: extraction ──
  const bytes = readFileSync(PDF);
  const isDocx = /\.docx$/i.test(PDF);
  const mime = isDocx
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), basename(PDF));
  console.log(`\n── leg 1: POST ${APP}/api/attachments/extract  (${basename(PDF)}, ${mime}, ${bytes.length} bytes) ──`);
  const er = await fetch(`${APP}/api/attachments/extract`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  const ed = await er.json() as { name?: string; text?: string; truncated?: boolean; error?: string };
  console.log(`HTTP ${er.status}`);
  if (!er.ok || !ed.text) {
    console.log(`❌ extraction failed: ${ed.error ?? '(no text)'}`);
    process.exit(1);
  }
  const extracted = ed.text;
  console.log(`✅ extracted ${extracted.length} chars${ed.truncated ? ' (truncated)' : ''}`);
  console.log(`   ${JSON.stringify(extracted.replace(/\s+/g, ' ').slice(0, 120))}`);
  const secretInExtract = extracted.includes(SECRET);
  console.log(`   secret phrase present in extraction: ${secretInExtract ? '✅' : '❌'}`);

  // ── Leg 2: does that text reach the model? ──
  const q = 'Read the attached file and quote its secret verification phrase back to me, exactly.';
  console.log(`\n── leg 2: POST ${APP}/api/chat with attachments[]  ──`);
  console.log(`   ask: ${JSON.stringify(q)}`);
  const cr = await fetch(`${APP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ id: 'att-1', role: 'user', content: q, parts: [{ type: 'text', text: q }] }],
      modelChoice: 'default',
      attachments: [{ name: ed.name ?? basename(PDF), text: extracted }],
    }),
  });
  console.log(`HTTP ${cr.status}  x-modus-model: ${cr.headers.get('x-modus-model') ?? '(none)'}`);
  const raw = await cr.text();
  let answer = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^0:(".*")$/);
    if (m) { try { answer += JSON.parse(m[1]); } catch { /* partial */ } }
  }
  console.log(`answer: ${JSON.stringify(answer.trim().slice(0, 240))}`);

  const modelSawIt = answer.includes(SECRET);
  console.log(`\nmodel quoted the file-only phrase: ${modelSawIt ? '✅' : '❌'}`);

  const ok = secretInExtract && modelSawIt;
  console.log(`\n${ok ? '✅ ATTACHMENTS WORK — a real PDF in, its content quoted back by the model on prod.' : '❌ attachment pipeline broken — see above.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
