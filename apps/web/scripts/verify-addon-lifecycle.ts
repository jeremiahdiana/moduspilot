/**
 * The limits add-on lifecycle, driven through the REAL webhook route against
 * REAL Stripe objects and REAL Firestore. Not a unit test — this is the thing
 * that would otherwise need someone to buy the add-on with a card.
 *
 * What it proves, in order:
 *   1. buying the add-on writes limitAddonQty
 *   2. changing the quantity in Stripe follows
 *   3. 🚨 cancelling the BASE plan while the add-on lives DOWNGRADES TO FREE
 *      (the bug that would leave someone on full MODUS for $10/mo)
 *   4. cancelling only the ADD-ON leaves the plan completely alone
 *
 * ── Why this is safe to run against a live key ──
 * Both temp subscriptions are created with a 30-day trial and NO payment method,
 * with trial_settings.end_behavior.missing_payment_method = 'cancel'. Nothing can
 * be charged: $0 during the trial, and Stripe cancels at trial end rather than
 * billing. Everything is deleted in a finally block regardless of outcome.
 *
 * Needs the dev server running so the webhook route is actually executed:
 *   cd apps/web && npx next dev -p 3111
 *   cd apps/web && npx tsx scripts/verify-addon-lifecycle.ts
 */
import { readFileSync } from 'fs';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const KEY = process.env.STRIPE_SECRET_KEY!;
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const HOOK_URL = process.env.HOOK_URL ?? 'http://localhost:3111/api/webhooks/stripe';
const ADDON_PRICE = process.env.STRIPE_PRICE_LIMIT_ADDON!;
const MODUS_PRICE = process.env.STRIPE_PRICE_MODUS!;

const stripe = new Stripe(KEY, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

let failed = false;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed = true;
}
function section(t: string) {
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);
}

const stamp = Date.now();
const UID = `verify-addon-${stamp}`;
const EMAIL = `verify-addon-${stamp}@moduspilot-verify.invalid`;

/** POST a properly-signed event at the real route, exactly as Stripe would. */
async function send(type: string, object: unknown) {
  const payload = JSON.stringify({
    id: `evt_verify_${stamp}_${Math.random().toString(36).slice(2, 8)}`,
    object: 'event',
    type,
    data: { object },
  });
  const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: WH_SECRET });
  const res = await fetch(HOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
    body: payload,
  });
  if (!res.ok) throw new Error(`${type} → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  // The route writes to Firestore before responding, but give the SDK a beat.
  await new Promise(r => setTimeout(r, 400));
}

const userDoc = async () => (await db.collection('users').doc(UID).get()).data() ?? {};

let customerId = '';
let planSubId = '';
let addonSubId = '';

async function main() {
  // Fail loudly rather than silently testing nothing.
  for (const [k, v] of Object.entries({ ADDON_PRICE, MODUS_PRICE, WH_SECRET })) {
    if (!v) throw new Error(`missing ${k} — cannot run`);
  }
  try {
    await fetch(HOOK_URL, { method: 'POST', body: '{}' });
  } catch {
    throw new Error(`dev server not reachable at ${HOOK_URL} — start it first`);
  }

  console.log(`mode: ${KEY.startsWith('sk_live') ? 'LIVE (trial-only, no payment method — nothing can be charged)' : 'TEST'}`);
  console.log(`uid : ${UID}`);

  // ── setup ────────────────────────────────────────────────────────────────
  const customer = await stripe.customers.create({ email: EMAIL, metadata: { uid: UID, verify: 'addon-lifecycle' } });
  customerId = customer.id;

  // 30-day trial, no payment method, cancel at trial end → $0, uncharageable.
  const trial = {
    trial_period_days: 30,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
  };
  const planSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: MODUS_PRICE, quantity: 1 }],
    metadata: { uid: UID, plan: 'modus' },
    ...trial,
  });
  planSubId = planSub.id;

  const addonSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: ADDON_PRICE, quantity: 1 }],
    metadata: { uid: UID, addon: 'limits' },
    ...trial,
  });
  addonSubId = addonSub.id;

  // The user doc as it stands after buying MODUS.
  await db.collection('users').doc(UID).set({
    email: EMAIL, plan: 'modus', stripeCustomerId: customerId, subscriptionId: planSubId,
  }, { merge: true });

  console.log(`stripe: customer ${customerId}\n        plan sub ${planSubId}\n        addon sub ${addonSubId}`);

  // ── 1. buying the add-on writes the quantity ─────────────────────────────
  section('1 buying the add-on');
  await send('checkout.session.completed', {
    id: `cs_verify_${stamp}`,
    object: 'checkout.session',
    payment_status: 'paid',
    customer: customerId,
    subscription: addonSubId,
    metadata: { uid: UID, addon: 'limits' },
  });
  let d = await userDoc();
  check('limitAddonQty is 1', d.limitAddonQty === 1, `got ${d.limitAddonQty}`);
  check('plan untouched', d.plan === 'modus', `plan=${d.plan}`);
  // 🪤 The quantity is NOT on the session — the route has to retrieve the
  // subscription. If that retrieve is ever dropped this stays 1 forever.
  check('subscriptionId still points at the PLAN, not the add-on',
    d.subscriptionId === planSubId, `${d.subscriptionId}`);

  // ── 2. changing quantity in Stripe follows ───────────────────────────────
  section('2 stacking to quantity 3');
  const item = addonSub.items.data[0].id;
  const bumped = await stripe.subscriptions.update(addonSubId, { items: [{ id: item, quantity: 3 }] });
  await send('customer.subscription.updated', bumped);
  d = await userDoc();
  check('limitAddonQty follows to 3', d.limitAddonQty === 3, `got ${d.limitAddonQty}`);
  check('plan still untouched', d.plan === 'modus', `plan=${d.plan}`);

  const { planCeilings } = await import('../lib/plan');
  const c = planCeilings(d);
  check('ceilings reflect it', c.window === 750_000 + 3 * 500_000,
    `window ${c.window.toLocaleString()} weekly ${c.weekly.toLocaleString()}`);

  // ── 3. 🚨 THE MONEY BUG: cancel the BASE plan, add-on survives ───────────
  section('3 cancelling the BASE plan while the add-on lives');
  const deadPlan = await stripe.subscriptions.cancel(planSubId);
  await send('customer.subscription.deleted', deadPlan);
  d = await userDoc();
  check('🚨 downgraded to free (NOT kept alive by the $10 add-on)',
    d.plan === 'free', `plan=${d.plan}`);
  check('subscriptionId cleared', d.subscriptionId === null, `${d.subscriptionId}`);
  check('limitAddonQty zeroed — a boost on a free account is meaningless',
    d.limitAddonQty === 0, `got ${d.limitAddonQty}`);

  const c2 = planCeilings(d);
  const { enforcePaidTokenLimit } = await import('../lib/chat/limits');
  check('free account is gated by enforceSubscriptionGate territory, not a ceiling',
    enforcePaidTokenLimit({ ...d, windowTokens: 999_999_999, windowStart: Date.now() }) === null,
    `window ceiling would be ${c2.window.toLocaleString()}`);

  // ── 4. cancelling only the add-on leaves a paying plan alone ─────────────
  section('4 cancelling ONLY the add-on');
  await db.collection('users').doc(UID).set(
    { plan: 'modus', subscriptionId: planSubId, limitAddonQty: 2 }, { merge: true },
  );
  const deadAddon = await stripe.subscriptions.cancel(addonSubId);
  await send('customer.subscription.deleted', deadAddon);
  d = await userDoc();
  check('plan survives', d.plan === 'modus', `plan=${d.plan}`);
  check('subscriptionId NOT repointed', d.subscriptionId === planSubId, `${d.subscriptionId}`);
  check('limitAddonQty dropped to 0', d.limitAddonQty === 0, `got ${d.limitAddonQty}`);
}

main()
  .catch(e => { console.error(`\n💥 ${e.message}`); failed = true; })
  .finally(async () => {
    section('cleanup');
    for (const id of [planSubId, addonSubId].filter(Boolean)) {
      try { await stripe.subscriptions.cancel(id); } catch { /* already cancelled */ }
    }
    if (customerId) {
      try { await stripe.customers.del(customerId); console.log(`   deleted customer ${customerId}`); }
      catch (e) { console.log(`   ⚠️ could not delete ${customerId}: ${(e as Error).message}`); }
    }
    try { await db.collection('users').doc(UID).delete(); console.log(`   deleted user ${UID}`); }
    catch { /* nothing to remove */ }

    // Belt and braces: nothing chargeable may survive this script.
    if (customerId) {
      const left = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
        .catch(() => ({ data: [] as Stripe.Subscription[] }));
      const alive = left.data.filter(s => s.status !== 'canceled');
      check('no live subscription left behind', alive.length === 0,
        alive.map(s => `${s.id}:${s.status}`).join(',') || 'none');
    }

    console.log(failed
      ? '\n❌ ADD-ON LIFECYCLE FAILED — do not sell it.\n'
      : '\n✅ ADD-ON LIFECYCLE HOLDS — buy, stack, cancel-base and cancel-addon all behave.\n');
    process.exit(failed ? 1 : 0);
  });
