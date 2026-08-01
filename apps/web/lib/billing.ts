/**
 * Billing invariants, in one place.
 *
 * Every bug this file exists to prevent was real and cost money:
 *
 *  - A founder paid $24 and got no plan, because the webhook wrote with Firestore
 *    `.update()` and his users doc didn't exist yet (he paid before onboarding).
 *  - A founder is being billed $48/mo, because a retry after a declined card
 *    minted a SECOND Stripe customer and a SECOND subscription: `stripeCustomerId`
 *    was only ever written by the success webhook, so nothing could see the first.
 *
 * The rules:
 *  1. Never `.update()` a users doc that might not exist — always set+merge.
 *  2. The Stripe customer is resolved and PERSISTED before checkout, never after.
 *  3. "Do they already pay?" is answered by Stripe, never by our own mirror of it.
 *  4. Never downgrade someone who still has another active subscription.
 */
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/** Subscription states that mean "this person is currently paying us". */
const LIVE_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];

/** A Stripe field typed `string | Object | null` — we only ever want the id. */
export function stripeId(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : v.id;
}

/**
 * Guarantee users/<uid> exists before anything tries to `.update()` it.
 * Cheap, idempotent, and the reason a webhook can no longer 500 on a new payer.
 */
export async function ensureUserDoc(uid: string, email?: string | null): Promise<void> {
  await adminDb.collection('users').doc(uid).set({
    ...(email ? { email } : {}),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Every Stripe customer id that could belong to this user: the one we recorded,
 * plus any customer sharing their email. The email sweep is what catches the
 * duplicates a previous retry created.
 */
export async function customerIdsForUser(uid: string, email?: string | null): Promise<string[]> {
  const ids = new Set<string>();
  const stored = (await adminDb.collection('users').doc(uid).get()).data()?.stripeCustomerId;
  const storedId = stripeId(stored as string | null);
  if (storedId) ids.add(storedId);
  if (email) {
    const found = await stripe.customers.list({ email, limit: 100 });
    for (const c of found.data) if (!c.deleted) ids.add(c.id);
  }
  return Array.from(ids);
}

/**
 * Resolve THE Stripe customer for this user and persist it immediately, so a
 * retry can never mint a second one. Order: what we stored → an existing customer
 * with this email → create one. Writing stripeCustomerId here (not in the success
 * webhook) is the whole fix for duplicate customers / double billing.
 */
export async function resolveStripeCustomer(uid: string, email?: string | null): Promise<string> {
  const stored = stripeId(
    (await adminDb.collection('users').doc(uid).get()).data()?.stripeCustomerId as string | null,
  );
  if (stored) {
    // Trust it only if it still exists and wasn't deleted in the dashboard.
    try {
      const c = await stripe.customers.retrieve(stored);
      if (!(c as Stripe.DeletedCustomer).deleted) return stored;
    } catch { /* fall through and re-resolve */ }
  }

  let customerId: string | undefined;
  if (email) {
    const found = await stripe.customers.list({ email, limit: 100 });
    // Oldest first: if duplicates already exist, always converge on the original
    // rather than adding to the pile.
    const live = found.data.filter(c => !c.deleted).sort((a, b) => a.created - b.created);
    customerId = live[0]?.id;
  }
  if (!customerId) {
    customerId = (await stripe.customers.create({
      ...(email ? { email } : {}),
      metadata: { uid },
    })).id;
  }

  await adminDb.collection('users').doc(uid).set({ stripeCustomerId: customerId }, { merge: true });
  return customerId;
}

/**
 * Ask STRIPE whether this user already pays — never our own Firestore mirror.
 * The mirror is exactly what's stale when the webhook failed, which is precisely
 * when someone is about to accidentally buy a second subscription.
 */
export async function findLiveSubscription(
  uid: string,
  email?: string | null,
  opts: { excludeSubId?: string } = {},
): Promise<Stripe.Subscription | null> {
  for (const customerId of await customerIdsForUser(uid, email)) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    for (const s of subs.data) {
      if (opts.excludeSubId && s.id === opts.excludeSubId) continue;
      if (LIVE_STATUSES.includes(s.status)) return s;
    }
  }
  return null;
}

/**
 * Downgrade to free ONLY if nothing else is still paying.
 *
 * A user can legitimately hold more than one subscription (a duplicate from a
 * retry, or a resubscribe overlapping a cancellation). Cancelling one of them
 * used to strip access from someone still being charged for the other.
 * Returns what it decided, for the webhook log.
 */
export async function downgradeIfNoLiveSubscription(
  uid: string,
  endedSubId: string,
  email?: string | null,
): Promise<'downgraded' | 'kept'> {
  const other = await findLiveSubscription(uid, email, { excludeSubId: endedSubId });
  if (other) {
    const plan = other.metadata?.plan;
    // Still paying — keep access, and re-point at the subscription that survives.
    await adminDb.collection('users').doc(uid).set({
      subscriptionId: other.id,
      ...(plan === 'modus' || plan === 'pilot' || plan === 'group' ? { plan } : {}),
    }, { merge: true });
    return 'kept';
  }
  await adminDb.collection('users').doc(uid).set({ plan: 'free', subscriptionId: null }, { merge: true });
  return 'downgraded';
}

/**
 * Which cadence is this subscription actually billed on, read off the live price
 * rather than anything we stored. Anything that isn't a yearly interval is
 * monthly — repricing someone onto a cadence they didn't buy is a billing change
 * they never agreed to.
 */
export function cadenceOfSubscription(sub: Stripe.Subscription): 'monthly' | 'annual' {
  return sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
}

/**
 * Is this a founding member's subscription?
 *
 * Founders pay the $24 MODUS price but carry `plan: 'pilot'` — the discount lives
 * entirely in that mismatch, not in a coupon or a dedicated price. So ANY
 * repricing silently moves them onto the $59 list price and the founding rate is
 * gone for good. Both signals are checked because either can be the one that
 * survived: `founding` on the users doc, or the Stripe metadata stamped at checkout.
 */
export function isFoundingSubscription(
  userData: Record<string, unknown> | undefined | null,
  sub: Stripe.Subscription | null | undefined,
): boolean {
  return userData?.founding === true || sub?.metadata?.founding === 'true';
}

/**
 * Did this checkout session actually get paid for?
 * `no_payment_required` is the legitimate trial case (card on file, $0 today).
 * `unpaid` is not — granting on it hands out a plan, and burns a founding seat,
 * for money that never arrived.
 */
export function sessionIsPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
}
