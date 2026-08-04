import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FOUNDING_COOKIE, verifyGate, toMillis } from '@/lib/founding';
import { ensureUserDoc, resolveStripeCustomer, findLivePlanSubscription, stripeId } from '@/lib/billing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.moduspilot.com';
// Founding members are billed on the $24 MODUS price but granted PILOT tier.
const FOUNDING_PRICE = process.env.STRIPE_PRICE_MODUS;
const FOUNDING_PLAN = 'pilot';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? undefined;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The gate cookie proves they passed a valid founding password.
  const codeId = verifyGate(cookies().get(FOUNDING_COOKIE)?.value);
  if (!codeId) return Response.json({ error: 'Enter your founding key first.' }, { status: 403 });
  if (!FOUNDING_PRICE) return Response.json({ error: 'Founding pricing is not configured.' }, { status: 500 });

  // VALIDATE the code but DO NOT consume it here. The seat is claimed only when
  // payment actually succeeds — in the Stripe webhook (checkout.session.completed).
  // Claiming at checkout-creation was a trap: abandoning the Stripe page left the
  // seat 'claimed'-but-unpaid, which flipped /grandfathering to "seat secured",
  // made /grandfathering/join redirect away, and permanently locked the founder
  // out of the $24 flow. Read-only validation gives a clean early error without
  // that side effect; a resume (same person, second attempt) just works.
  const codeRef = adminDb.collection('foundingCodes').doc(codeId);
  const codeData = (await codeRef.get()).data() as
    { status?: string; claimedByUid?: string; expiresAt?: unknown } | undefined;
  if (!codeData) {
    return Response.json({ error: 'That founding key no longer exists.' }, { status: 404 });
  }
  // Already claimed by someone else = the spot is genuinely gone (paid founder).
  if (codeData.status === 'claimed' && codeData.claimedByUid !== uid) {
    return Response.json({ error: 'This founding spot has already been claimed.', code: 'already_claimed' }, { status: 409 });
  }
  // Unclaimed + past expiry: block before sending them to Stripe. A key already
  // claimed by THIS uid is a paid member and never expires out from under them.
  if (codeData.status !== 'claimed') {
    const expMs = toMillis(codeData.expiresAt);
    if (expMs != null && Date.now() > expMs) {
      return Response.json({ error: 'This invitation has expired.', code: 'expired' }, { status: 410 });
    }
  }

  // The founding flow signs in and comes straight here — onboarding, which is
  // what normally creates users/<uid>, hasn't run. Guarantee the doc exists
  // before Stripe is involved, so no later write can hit `5 NOT_FOUND`.
  await ensureUserDoc(uid, email);

  // Ask STRIPE whether they already pay, not our own Firestore mirror. The mirror
  // is only written by the success webhook, so it is precisely blank when the
  // webhook failed — which is exactly when a user is about to buy a SECOND
  // subscription. Checking Firestore here is how one founder ended up at $48/mo.
  // Plan subscriptions only — a $10 limits add-on is not "they already pay for a
  // plan", and treating it as one would bounce a legitimate founding redemption.
  const live = await findLivePlanSubscription(uid, email);
  if (live) {
    // Self-heal: the money is real, so make Firestore agree before sending them in.
    const plan = live.metadata?.plan;
    await adminDb.collection('users').doc(uid).set({
      subscriptionId: live.id,
      stripeCustomerId: stripeId(live.customer),
      ...(plan === 'modus' || plan === 'pilot' || plan === 'group' ? { plan } : {}),
    }, { merge: true });
    return Response.json({ alreadyActive: true, url: `${APP_URL}/welcome` });
  }

  // Resolve + PERSIST the customer before checkout. Passing customer_email lets
  // Stripe mint a brand new customer on every retry (declined card, back button),
  // and each one can carry its own subscription — the double-billing mechanism.
  const customerId = await resolveStripeCustomer(uid, email);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: FOUNDING_PRICE, quantity: 1 }],
    success_url: `${APP_URL}/welcome`,
    cancel_url: `${APP_URL}/grandfathering`,
    customer: customerId,
    // Founders are charged $24 immediately (no trial). The webhook reads
    // metadata.plan ('pilot') — NOT the price — so this $24 sub grants PILOT.
    // foundingCodeId lets the webhook claim the seat on payment success.
    subscription_data: {
      metadata: { uid, plan: FOUNDING_PLAN, founding: 'true', foundingCodeId: codeId },
    },
    payment_method_collection: 'always',
    metadata: { uid, plan: FOUNDING_PLAN, founding: 'true', foundingCodeId: codeId },
  });

  return Response.json({ url: session.url });
}
