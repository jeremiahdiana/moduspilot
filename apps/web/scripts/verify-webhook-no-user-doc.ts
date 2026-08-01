/**
 * Prove the DEPLOYED Stripe webhook grants a plan to a payer whose users doc
 * does NOT exist yet — the exact case that stranded founding member #26.
 *
 * He signed in with Google, went straight to /grandfathering and paid, all
 * before onboarding created users/<uid>. The handler used Firestore .update(),
 * which throws `5 NOT_FOUND: No document to update`, so checkout.session.completed
 * 500'd on every Stripe retry and a real $24 payer sat on no plan.
 *
 *   cd apps/web && npx tsx scripts/verify-webhook-no-user-doc.ts
 *
 * Builds a checkout.session.completed payload for a THROWAWAY uid, signs it with
 * STRIPE_WEBHOOK_SECRET exactly as Stripe does, POSTs it to the live endpoint,
 * then asserts the users doc was created with plan=pilot. Deletes the temp doc
 * and temp founding code afterwards. Touches no real user and no real money.
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const APP = process.env.MODUS_SMOKE_URL || 'https://app.moduspilot.com';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

// Sign a payload the way Stripe signs webhooks: v1 = HMAC-SHA256("<t>.<body>").
function stripeSignature(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

async function main() {
  if (!SECRET) { console.error('STRIPE_WEBHOOK_SECRET missing from .env.local'); process.exit(1); }

  const { adminDb } = await import('@/lib/firebase-admin');

  const uid = `verifywebhook_${crypto.randomBytes(8).toString('hex')}`;
  const codeId = crypto.createHash('sha256').update(`verify-${uid}`).digest('hex');
  const userRef = adminDb.collection('users').doc(uid);
  const codeRef = adminDb.collection('foundingCodes').doc(codeId);

  console.log(`🧪 deployed webhook, payer with NO users doc → ${APP}\n`);
  console.log(`temp uid    = ${uid}`);
  console.log(`temp codeId = ${codeId}\n`);

  try {
    await codeRef.set({
      label: 'VERIFY (temp)', foundingNumber: 999, status: 'available',
      claimedByUid: null, claimedAt: null, expiresAt: null,
    });

    // PRECONDITION — the users doc must genuinely not exist. This is the bug's setup.
    check('precondition: users doc does NOT exist', !(await userRef.get()).exists);

    const body = JSON.stringify({
      id: `evt_verify_${crypto.randomBytes(6).toString('hex')}`,
      object: 'event',
      type: 'checkout.session.completed',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_verify_${crypto.randomBytes(6).toString('hex')}`,
          object: 'checkout.session',
          customer: 'cus_VERIFY_TEMP',
          subscription: 'sub_VERIFY_TEMP',
          payment_status: 'paid',
          status: 'complete',
          metadata: { uid, plan: 'pilot', founding: 'true', foundingCodeId: codeId },
        },
      },
    });

    console.log('── POST /api/webhooks/stripe (validly signed) ──');
    const res = await fetch(`${APP}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, SECRET) },
      body,
    });
    const text = await res.text();
    console.log(`   HTTP ${res.status}  ${text.slice(0, 120)}`);
    check('webhook returns 200 (did NOT 500 on the missing doc)', res.status === 200, `status=${res.status}`);

    // The grant is the whole point: doc created, plan actually pilot.
    const after = (await userRef.get()).data() as Record<string, unknown> | undefined;
    check('users doc was CREATED by the webhook', !!after);
    check('plan granted = pilot', after?.plan === 'pilot', `plan=${after?.plan ?? '—'}`);
    check('founding flag set', after?.founding === true);
    check('subscriptionId written', after?.subscriptionId === 'sub_VERIFY_TEMP', `${after?.subscriptionId ?? '—'}`);
    check('stripeCustomerId written', after?.stripeCustomerId === 'cus_VERIFY_TEMP', `${after?.stripeCustomerId ?? '—'}`);

    const code = (await codeRef.get()).data() as Record<string, unknown> | undefined;
    check('founding seat claimed by this uid', code?.status === 'claimed' && code?.claimedByUid === uid,
      `status=${code?.status} by=${code?.claimedByUid}`);

    // Idempotency: Stripe retries. A second delivery must not break anything.
    const res2 = await fetch(`${APP}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, SECRET) },
      body,
    });
    check('replay is idempotent (200 again)', res2.status === 200, `status=${res2.status}`);

    // A bad signature must still be rejected — we did not weaken the gate.
    const resBad = await fetch(`${APP}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
      body,
    });
    check('invalid signature still rejected (400)', resBad.status === 400, `status=${resBad.status}`);
  } finally {
    await userRef.delete().catch(() => {});
    await codeRef.delete().catch(() => {});
    console.log('\n🧹 temp user + temp founding code deleted');
  }

  console.log(failures === 0
    ? '\n✅ WEBHOOK HANDLES THE PAY-BEFORE-ONBOARDING CASE — plan granted, seat claimed, signature gate intact.'
    : `\n❌ ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
