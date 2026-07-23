/**
 * The launch path: a paying stranger with NOTHING connected.
 *
 * 🚨 EVERY OTHER TEST IN THIS REPO RUNS AS THE FOUNDER — fully connected Gmail
 * and Calendar, a GitMCP server, stored memories, a pilot plan. A real new
 * customer has none of that, so on their very first message every context
 * fetcher returns empty, every block is '', and nothing has ever verified that
 * MODUS still answers well in that state. That is the ONLY path a launch
 * actually consists of.
 *
 * Creates a throwaway account, simulates the Stripe webhook by setting a paid
 * plan (no card, no charge), drives the REAL production endpoints, and DELETES
 * the account in a finally block so it cleans up even on failure.
 *
 *   cd apps/web && npx tsx scripts/verify-new-consumer.ts
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

const APP = process.env.MODUS_APP_URL || 'https://app.moduspilot.com';

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

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${String(detail).slice(0, 300)}`); }
}

async function idToken(uid: string): Promise<string> {
  const custom = await getAuth(app()).createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const data = await res.json() as { idToken?: string };
  if (!data.idToken) throw new Error('token exchange failed');
  return data.idToken;
}

/** Send one message exactly as the browser does, return the decoded stream. */
async function send(token: string, text: string, modelChoice = 'default') {
  const started = Date.now();
  const res = await fetch(`${APP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ id: 'm1', role: 'user', content: text, parts: [{ type: 'text', text }] }],
      modelChoice,
      personalContext: '',
      responseStyle: 'normal',
      briefingHour: 7,
      briefingTimezone: 'Australia/Sydney',
    }),
  });
  const raw = res.ok ? await res.text() : await res.text();
  let answer = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^0:(".*")$/);
    if (m) { try { answer += JSON.parse(m[1]); } catch { /* partial */ } }
  }
  const err = raw.split('\n').find(l => l.startsWith('3:'));
  // Which model actually faced a brand-new customer. The intent rides in the
  // header; a runtime failover overrides it via the annotation.
  const intended = res.headers.get('x-modus-model') ?? '?';
  const servedM = raw.match(/"modusServedModel":"([^"]+)"/)?.[1];
  return { status: res.status, answer: answer.trim(), err, ms: Date.now() - started, raw, model: servedM ?? intended, failedOver: !!servedM };
}

async function main() {
  const auth = getAuth(app());
  const db = getFirestore(app());
  db.settings({ preferRest: true, ignoreUndefinedProperties: true });

  const email = `new-consumer-${Date.now()}@example.com`;
  const user = await auth.createUser({ email, password: `Pw!${Math.random().toString(36).slice(2)}A9` });
  console.log(`\ncreated ${email}\nuid=${user.uid}\n`);

  try {
    // Exactly what the app writes at signup, and nothing else. No google tokens,
    // no MCP servers, no memories, no capabilities, no saved model.
    await db.collection('users').doc(user.uid).set({
      email,
      name: 'Alex Stranger',
      onboardingComplete: true,
      createdAt: new Date(),
    }, { merge: true });

    const token = await idToken(user.uid);

    console.log('── before paying ──');
    const gated = await send(token, 'hello');
    check('an unpaid stranger is blocked (the paywall works)', gated.status === 402, `${gated.status} ${gated.raw.slice(0, 120)}`);

    // Simulate the Stripe webhook. No card, no charge — just the entitlement it
    // would write, so the POST-PURCHASE experience can be exercised at all.
    await db.collection('users').doc(user.uid).set({ plan: 'modus' }, { merge: true });
    console.log('\n── after paying (plan=modus, nothing connected) ──');

    const cases: { label: string; text: string; mustNotSay?: RegExp; mustSay?: RegExp }[] = [
      { label: 'a greeting', text: 'hey' },
      { label: 'general knowledge', text: 'Explain compound interest in two sentences.' },
      // The dangerous ones: personal questions with NO connected data. MODUS must
      // say it has nothing connected — never invent an inbox or a calendar.
      // A never-connected user must NOT be told to RECONNECT (they never did),
      // and must NOT be told the inbox/calendar is empty (MODUS cannot see it).
      { label: 'email with no Gmail connected', text: 'any emails i should care about',
        mustNotSay: /reconnect|re-connect|no (new )?emails|inbox is empty|nothing in your inbox/i,
        mustSay: /not connected|connect|link/i },
      { label: 'calendar with no Calendar connected', text: 'whats on my calendar today',
        mustNotSay: /no events|nothing (scheduled|on)|calendar is (clear|empty)|wide open|free all day/i,
        mustSay: /not connected|connect|link/i },
      { label: 'a vague personal question', text: 'what should i focus on today' },
      { label: 'a follow-up shape', text: 'can you make that shorter' },
    ];

    for (const c of cases) {
      const r = await send(token, c.text);
      console.log(`\n   ${c.label}  (${r.ms}ms, ${r.answer.length} chars)  model=${r.model}${r.failedOver ? ' [FAILED OVER]' : ''}`);
      console.log(`   → ${JSON.stringify(r.answer.slice(0, 160))}`);
      check(`  ${c.label}: answers at all`, r.status === 200 && r.answer.length > 0, r.err ?? r.status);
      if (c.mustNotSay) {
        check(`  ${c.label}: does not fabricate data it cannot see`, !c.mustNotSay.test(r.answer), r.answer.slice(0, 200));
      }
      if (c.mustSay) {
        check(`  ${c.label}: tells them it is not connected`, c.mustSay.test(r.answer), r.answer.slice(0, 200));
      }
    }

    console.log('\n── every model, as a brand-new customer ──');
    // A paid MODUS plan, so only the modus-tier models. A stranger picking one
    // from the composer must not get a blank bubble.
    for (const m of ['claude-sonnet-5', 'gpt-5.6-terra', 'gemini-3.5-flash', 'meta/llama-3.3-70b']) {
      const r = await send(token, 'Say OK in one word.', m);
      check(`  ${m} answers for a new account`, r.answer.length > 0, r.err ?? `${r.status}`);
    }
  } finally {
    await auth.deleteUser(user.uid).catch(() => {});
    await getFirestore(app()).collection('users').doc(user.uid).delete().catch(() => {});
    console.log(`\n🧹 cleaned up ${user.uid}`);
  }

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
