/**
 * The billing audit, as executable checks. Each one corresponds to a real bug
 * found on 2026-08-02 that could take money or take away access someone paid for.
 *
 *   cd apps/web && npx tsx scripts/verify-billing-invariants.ts
 *
 * Mix of three kinds of evidence, labelled per check:
 *   [PROD]   driven through the DEPLOYED webhook with a validly signed event
 *   [STRIPE] run locally against real production Stripe data (read-only)
 *   [STATIC] source-level guard, so a fixed class of bug can't quietly return
 *
 * Only ever writes throwaway Firestore docs + one throwaway Stripe customer,
 * all deleted in `finally`. Never touches a real user's doc or a real sub.
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

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
function section(s: string) { console.log(`\n── ${s} ──`); }

function stripeSignature(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

function sessionEvent(uid: string, codeId: string, paymentStatus: string) {
  return JSON.stringify({
    id: `evt_inv_${crypto.randomBytes(6).toString('hex')}`,
    object: 'event', type: 'checkout.session.completed', api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    data: { object: {
      id: `cs_inv_${crypto.randomBytes(6).toString('hex')}`, object: 'checkout.session',
      customer: 'cus_INV_TEMP', subscription: 'sub_INV_TEMP',
      payment_status: paymentStatus, status: 'complete',
      metadata: { uid, plan: 'pilot', founding: 'true', foundingCodeId: codeId },
    } },
  });
}

async function postWebhook(body: string) {
  return fetch(`${APP}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, SECRET) },
    body,
  });
}

async function main() {
  const { adminDb } = await import('@/lib/firebase-admin');
  const { stripe } = await import('@/lib/stripe');
  const billing = await import('@/lib/billing');

  const tmpUids: string[] = [];
  const tmpCodeIds: string[] = [];
  let tmpCustomerId: string | null = null;
  const uid = (tag: string) => {
    const u = `verifybill_${tag}_${crypto.randomBytes(6).toString('hex')}`;
    tmpUids.push(u); return u;
  };

  console.log(`🧾 billing invariants → ${APP}\n`);

  try {
    // ── 1. The original bug: a payer whose users doc doesn't exist yet ────────
    section('1 [PROD] webhook grants to a payer with NO users doc (the Jian bug)');
    {
      const u = uid('nodoc');
      const codeId = crypto.createHash('sha256').update(`inv-${u}`).digest('hex');
      tmpCodeIds.push(codeId);
      await adminDb.collection('foundingCodes').doc(codeId).set({
        label: 'VERIFY (temp)', foundingNumber: 998, status: 'available',
        claimedByUid: null, claimedAt: null, expiresAt: null,
      });
      check('precondition: no users doc', !(await adminDb.collection('users').doc(u).get()).exists);
      const res = await postWebhook(sessionEvent(u, codeId, 'paid'));
      const d = (await adminDb.collection('users').doc(u).get()).data() as any;
      check('webhook 200 (no 5 NOT_FOUND)', res.status === 200, `status=${res.status}`);
      check('plan granted', d?.plan === 'pilot', `plan=${d?.plan ?? '—'}`);
    }

    // ── 2. Never grant a plan for money that never arrived ────────────────────
    section('2 [PROD] an UNPAID checkout session grants nothing and burns no seat');
    {
      const u = uid('unpaid');
      const codeId = crypto.createHash('sha256').update(`inv-${u}`).digest('hex');
      tmpCodeIds.push(codeId);
      await adminDb.collection('foundingCodes').doc(codeId).set({
        label: 'VERIFY (temp)', foundingNumber: 997, status: 'available',
        claimedByUid: null, claimedAt: null, expiresAt: null,
      });
      const res = await postWebhook(sessionEvent(u, codeId, 'unpaid'));
      const d = (await adminDb.collection('users').doc(u).get()).data() as any;
      const code = (await adminDb.collection('foundingCodes').doc(codeId).get()).data() as any;
      check('webhook still 200 (acknowledged, not retried forever)', res.status === 200, `status=${res.status}`);
      check('NO plan granted on an unpaid session', d?.plan === undefined, `plan=${d?.plan ?? '—'}`);
      check('founding seat NOT burned', code?.status === 'available', `status=${code?.status}`);
    }
    section('2b [STATIC] trial sessions ($0 today) still count as paid');
    {
      const paid = (s: string) => billing.sessionIsPaid({ payment_status: s } as never);
      check('paid → grant', paid('paid'));
      check('no_payment_required (trial) → grant', paid('no_payment_required'));
      check('unpaid → do NOT grant', !paid('unpaid'));
    }

    // ── 3. Duplicate customers = double billing (Oliver, $48/mo) ──────────────
    section('3 [STRIPE] resolveStripeCustomer is idempotent — a retry reuses the customer');
    {
      const u = uid('cust');
      const email = `verify-billing-${crypto.randomBytes(5).toString('hex')}@moduspilot-verify.invalid`;
      const first = await billing.resolveStripeCustomer(u, email);
      tmpCustomerId = first;
      const second = await billing.resolveStripeCustomer(u, email);
      const third = await billing.resolveStripeCustomer(u, email);
      check('same customer across 3 calls (was: a new one each retry)',
        first === second && second === third, `${first} / ${second} / ${third}`);
      const all = await stripe.customers.list({ email, limit: 10 });
      check('exactly ONE Stripe customer exists for that email', all.data.length === 1, `count=${all.data.length}`);
      const stored = (await adminDb.collection('users').doc(u).get()).data()?.stripeCustomerId;
      check('customer persisted to Firestore BEFORE checkout (not in the webhook)',
        stored === first, `stored=${stored ?? '—'}`);
    }

    // ── 4. Cancelling one of two subs must not revoke paid access ─────────────
    section('4 [STRIPE] downgrade guard, against the REAL double-billed account');
    {
      // Read-only against Oliver's two genuinely-live subscriptions. The temp doc
      // is what gets written; his real doc is never touched.
      const OLIVER_EMAIL = 'baasandoooliver@gmail.com';
      const subs: string[] = [];
      for (const c of (await stripe.customers.list({ email: OLIVER_EMAIL, limit: 20 })).data) {
        for (const s of (await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20 })).data) {
          if (s.status === 'active' || s.status === 'trialing') subs.push(s.id);
        }
      }
      check('fixture: the double-billed account really has 2+ live subs', subs.length >= 2, `found=${subs.length}`);

      if (subs.length >= 2) {
        const u = uid('keep');
        await adminDb.collection('users').doc(u).set({ plan: 'pilot', email: OLIVER_EMAIL, subscriptionId: subs[0] });
        const outcome = await billing.downgradeIfNoLiveSubscription(u, subs[0], OLIVER_EMAIL);
        const d = (await adminDb.collection('users').doc(u).get()).data() as any;
        check('cancelling ONE of two live subs → access KEPT', outcome === 'kept', `outcome=${outcome}`);
        check('plan not stripped', d?.plan === 'pilot', `plan=${d?.plan}`);
        check('re-pointed at the surviving subscription', d?.subscriptionId === subs[1], `sub=${d?.subscriptionId}`);
      }

      // Control: the same call with nothing else live MUST still downgrade,
      // otherwise the guard would just never revoke anything.
      const u2 = uid('drop');
      await adminDb.collection('users').doc(u2).set({ plan: 'pilot', subscriptionId: 'sub_GONE' });
      const outcome2 = await billing.downgradeIfNoLiveSubscription(u2, 'sub_GONE', null);
      const d2 = (await adminDb.collection('users').doc(u2).get()).data() as any;
      check('control: last subscription ends → DOES downgrade to free',
        outcome2 === 'downgraded' && d2?.plan === 'free', `outcome=${outcome2} plan=${d2?.plan}`);
    }

    // ── 5. "Already subscribed?" must be answered by Stripe, not our mirror ───
    section('5 [STRIPE] findLiveSubscription sees a sub even when Firestore is blank');
    {
      const OLIVER_EMAIL = 'baasandoooliver@gmail.com';
      const u = uid('mirror');
      await adminDb.collection('users').doc(u).set({ email: OLIVER_EMAIL }); // no plan, no subscriptionId
      const live = await billing.findLiveSubscription(u, OLIVER_EMAIL);
      check('finds the live subscription with an EMPTY Firestore mirror', !!live, `sub=${live?.id ?? 'none'}`);
      const none = await billing.findLiveSubscription(uid('nobody'), 'nobody-verify@moduspilot-verify.invalid');
      check('control: reports none for a user with no Stripe presence', none === null);
    }

    // ── 6. ensureUserDoc ─────────────────────────────────────────────────────
    section('6 [STRIPE] ensureUserDoc creates the doc the checkout routes depend on');
    {
      const u = uid('ensure');
      check('precondition: absent', !(await adminDb.collection('users').doc(u).get()).exists);
      await billing.ensureUserDoc(u, 'x@moduspilot-verify.invalid');
      check('created', (await adminDb.collection('users').doc(u).get()).exists);
      await adminDb.collection('users').doc(u).set({ plan: 'pilot' }, { merge: true });
      await billing.ensureUserDoc(u, 'x@moduspilot-verify.invalid');
      const d = (await adminDb.collection('users').doc(u).get()).data() as any;
      check('re-running never clobbers an existing plan', d?.plan === 'pilot', `plan=${d?.plan}`);
    }

    // ── 7. The class of bug, banned at the source ────────────────────────────
    section('7 [STATIC] no `.update()` on a root users doc anywhere in app/ or lib/');
    {
      // Firestore .update() throws `5 NOT_FOUND` on a missing doc. On a users doc
      // that is reachable — a user can exist in Auth, and pay, before onboarding
      // creates their doc. set(..., {merge:true}) is always correct here.
      let out = '';
      try {
        out = execSync(
          `grep -rnE "collection\\('users'\\)\\.doc\\([^)]*\\)\\.update\\(" app lib || true`,
          { encoding: 'utf8' },
        ).trim();
      } catch { /* grep exit 1 = no matches */ }
      check('zero `users.doc(...).update(` call sites', out === '', out || 'none');
    }
  } finally {
    for (const u of tmpUids) await adminDb.collection('users').doc(u).delete().catch(() => {});
    for (const c of tmpCodeIds) await adminDb.collection('foundingCodes').doc(c).delete().catch(() => {});
    if (tmpCustomerId) await stripe.customers.del(tmpCustomerId).catch(() => {});
    console.log(`\n🧹 cleaned up ${tmpUids.length} temp users, ${tmpCodeIds.length} temp codes` +
                `${tmpCustomerId ? ', 1 temp Stripe customer' : ''}`);
  }

  console.log(failures === 0
    ? '\n✅ ALL BILLING INVARIANTS HOLD.'
    : `\n❌ ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
