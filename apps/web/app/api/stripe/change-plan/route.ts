import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Plan changes for an EXISTING subscriber. Unlike /checkout (which is for brand
// new customers and always attaches a 3-day trial), this repricing the customer's
// current subscription in place — so upgrading never grants another free trial
// and never leaves a second, parallel subscription billing alongside the first.
const PRICE_IDS: Record<string, string | undefined> = {
  modus: process.env.STRIPE_PRICE_MODUS,
  pilot: process.env.STRIPE_PRICE_PILOT,
  group: process.env.STRIPE_PRICE_GROUP,
};

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
  const priceId = PRICE_IDS[newPlan];
  if (!priceId || newPlan === 'free') return Response.json({ error: 'Invalid plan' }, { status: 400 });

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

  // Upgrade → invoice the prorated difference now. Downgrade → credit the next
  // invoice. (While still in trial, Stripe defers any charge to trial end.) The
  // metadata.plan drives the customer.subscription.updated webhook.
  const isUpgrade = (RANK[newPlan] ?? 0) > (RANK[currentPlan] ?? 0);
  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
    metadata: { uid, plan: newPlan },
  });

  // Reflect immediately; the subscription.updated webhook also sets this (idempotent).
  await userRef.update({ plan: newPlan });

  return Response.json({ updated: true, plan: newPlan });
}
