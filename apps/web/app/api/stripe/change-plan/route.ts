import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { resolvePlanPrice } from '@/lib/pricing';
import { cadenceOfSubscription, isFoundingSubscription } from '@/lib/billing';

// Plan changes for an EXISTING subscriber. Unlike /checkout (which is for brand
// new customers and always attaches a 3-day trial), this repricing the customer's
// current subscription in place — so upgrading never grants another free trial
// and never leaves a second, parallel subscription billing alongside the first.
// Price order, so we can charge immediately on an upgrade but only credit the
// next invoice on a downgrade.
const RANK: Record<string, number> = { free: 0, modus: 1, pilot: 2, group: 3 };

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan: newPlan } = await req.json() as { plan: string };
  if (newPlan === 'free') return Response.json({ error: 'Invalid plan' }, { status: 400 });

  const userRef = adminDb.collection('users').doc(uid);
  const userData = (await userRef.get()).data() ?? {};
  const subId = userData.subscriptionId as string | undefined;
  const currentPlan = (userData.plan as string | undefined) ?? 'free';

  // No active subscription → the caller should use /checkout (new customer + trial).
  if (!subId) return Response.json({ error: 'No active subscription to change.' }, { status: 409 });
  if (newPlan === currentPlan) return Response.json({ error: 'Already on this plan.' }, { status: 400 });

  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch {
    return Response.json({ error: 'Subscription not found — contact support.' }, { status: 404 });
  }
  const itemId = sub.items.data[0]?.id;
  if (!itemId) return Response.json({ error: 'Subscription has no items.' }, { status: 500 });

  // A founding member's discount IS the mismatch between the $24 MODUS price and
  // their 'pilot' plan — there is no coupon holding it. Repricing them to any list
  // price destroys the founding rate permanently, and they were promised it for
  // life. Refuse and let a human handle it, rather than silently charging a
  // founder $59. (Group is the only genuine upgrade a founder could want, and
  // Group isn't self-serve sellable yet anyway.)
  if (isFoundingSubscription(userData, sub)) {
    return Response.json({
      error: 'Your founding rate is locked in. Contact us and we will move you across by hand.',
      code: 'founding_locked',
    }, { status: 409 });
  }

  // Keep them on the cadence they actually bought. This map used to be monthly-only,
  // so changing plan moved an annual subscriber onto monthly billing without asking.
  // Read the cadence off the live subscription, never off anything we stored.
  const currentCadence = cadenceOfSubscription(sub);
  const { priceId, cadence } = resolvePlanPrice(newPlan, currentCadence);
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  // If the target plan has no price at the cadence they're on (Group is monthly
  // only), that's a real billing-frequency change — say so instead of doing it quietly.
  if (cadence !== currentCadence) {
    return Response.json({
      error: `${newPlan} isn't available on ${currentCadence} billing. Contact us to switch.`,
      code: 'cadence_unavailable',
    }, { status: 409 });
  }

  // Upgrade → invoice the prorated difference now. Downgrade → credit the next
  // invoice. (While still in trial, Stripe defers any charge to trial end.) The
  // metadata.plan drives the customer.subscription.updated webhook.
  const isUpgrade = (RANK[newPlan] ?? 0) > (RANK[currentPlan] ?? 0);
  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
    // cadence is carried so the mirror matches what Stripe is actually billing.
    metadata: { uid, plan: newPlan, cadence },
  });

  // Reflect immediately; the subscription.updated webhook also sets this (idempotent).
  // set+merge so this can never throw `5 NOT_FOUND` on a missing users doc.
  await userRef.set({ plan: newPlan }, { merge: true });

  return Response.json({ updated: true, plan: newPlan, cadence });
}
