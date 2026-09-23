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
 * Short-lived, per-user lock around checkout-session creation.
 *
 * The duplicate-subscription guard (findLivePlanSubscription -> create session) is
 * check-then-act: two requests in flight at once (two tabs, a fast retry) each see
 * "no live sub" and each create a session, so two subscriptions can still be born
 * on one customer. That is how a real founder ended up at $48/mo. This lock makes
 * the second concurrent attempt bounce instead.
 *
 * Fail-OPEN on any Firestore error, same as the founding rate limiter: a lock
 * outage must never block a paying customer from checking out. The lock simply
 * lapses by TTL, so no explicit release is needed (a completed checkout redirects
 * the user away).
 */
export async function acquireCheckoutLock(uid: string, ttlMs = 120_000): Promise<boolean> {
  const ref = adminDb.collection('checkoutLocks').doc(uid);
  try {
    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = snap.data() as { lockedAt?: number } | undefined;
      const held = data?.lockedAt != null && now - data.lockedAt < ttlMs;
      if (held) return false;
      tx.set(ref, { lockedAt: now });
      return true;
    });
  } catch {
    return true;
  }
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
    // Oldest first: if duplicates already exist, converge on the original rather
    // than adding to the pile.
    const live = found.data.filter(c => !c.deleted).sort((a, b) => a.created - b.created);
    // ...BUT a duplicate that already holds the paying subscription must win. The
    // oldest record is not always the one being billed — a real founder's active
    // sub sat on the NEWEST of three customer records. Persisting the oldest here
    // would point stripeCustomerId at a customer with no subscription and break
    // the portal / management path. Prefer whichever customer carries a live sub.
    if (live.length > 1) {
      for (const c of live) {
        const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 100 });
        if (subs.data.some(s => LIVE_STATUSES.includes(s.status))) { customerId = c.id; break; }
      }
    }
    customerId = customerId ?? live[0]?.id;
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
 * Is this an add-on subscription rather than a plan?
 *
 * Add-ons are stamped `metadata.addon` at checkout and deliberately carry NO
 * `metadata.plan`, so they can never be mistaken for something that grants access.
 */
export function isAddonSubscription(sub: Stripe.Subscription | null | undefined): boolean {
  return typeof sub?.metadata?.addon === 'string' && sub.metadata.addon.length > 0;
}

/**
 * Ask STRIPE whether this user already pays — never our own Firestore mirror.
 * The mirror is exactly what's stale when the webhook failed, which is precisely
 * when someone is about to accidentally buy a second subscription.
 *
 * 🚨 `excludeAddons` IS NOT OPTIONAL THINKING — IT DECIDES WHETHER ACCESS SURVIVES.
 *
 * Since the $10 limits add-on shipped, a user can hold TWO live subscriptions: the
 * plan they pay for and an add-on that grants no access on its own. Any caller
 * asking "does this user still have a plan?" must pass excludeAddons, or:
 *
 *   - downgradeIfNoLiveSubscription finds the surviving add-on and returns 'kept',
 *     leaving someone on full MODUS for $10/mo after they cancelled the $24 plan;
 *   - the self-heal writes repoint users/{uid}.subscriptionId at the add-on, and
 *     change-plan then reprices the ADD-ON to $24 or $59.
 *
 * Callers gating "may this user buy a subscription at all" (checkout) want the
 * opposite — they care about every live sub — so this defaults to false and the
 * access-deciding callers opt in.
 */
export async function findLiveSubscription(
  uid: string,
  email?: string | null,
  opts: { excludeSubId?: string; excludeAddons?: boolean } = {},
): Promise<Stripe.Subscription | null> {
  for (const customerId of await customerIdsForUser(uid, email)) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    for (const s of subs.data) {
      if (opts.excludeSubId && s.id === opts.excludeSubId) continue;
      if (opts.excludeAddons && isAddonSubscription(s)) continue;
      if (LIVE_STATUSES.includes(s.status)) return s;
    }
  }
  return null;
}

/**
 * The live subscription that actually represents this user's PLAN, ignoring
 * add-ons. This is the one to mirror into users/{uid}.subscriptionId and the one
 * change-plan is allowed to reprice.
 */
export async function findLivePlanSubscription(
  uid: string,
  email?: string | null,
  opts: { excludeSubId?: string } = {},
): Promise<Stripe.Subscription | null> {
  return findLiveSubscription(uid, email, { ...opts, excludeAddons: true });
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
  // Add-ons are excluded on purpose: a $10 limits add-on is not a plan, and
  // letting one keep access alive would leave a cancelled subscriber on full
  // MODUS for $10/mo. See findLiveSubscription.
  const other = await findLivePlanSubscription(uid, email, { excludeSubId: endedSubId });
  if (other) {
    const plan = other.metadata?.plan;
    // Still paying — keep access, and re-point at the subscription that survives.
    await adminDb.collection('users').doc(uid).set({
      subscriptionId: other.id,
      ...(plan === 'modus' || plan === 'pilot' || plan === 'group' ? { plan } : {}),
    }, { merge: true });
    return 'kept';
  }
  // No plan left. Clear the add-on quantity too — a ceiling boost on a free
  // account is meaningless, and leaving it set would silently re-apply if they
  // resubscribe later without re-buying the add-on.
  await adminDb.collection('users').doc(uid).set(
    { plan: 'free', subscriptionId: null, limitAddonQty: 0 },
    { merge: true },
  );
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

/**
 * The subscription id an invoice belongs to, across Stripe API versions.
 *
 * Stripe renders webhook payloads at the version configured on the ENDPOINT, which
 * can be newer than the SDK's pinned apiVersion. Newer versions moved the flat
 * `invoice.subscription` field onto `invoice.parent.subscription_details.subscription`.
 * The invoice.payment_failed downgrade read only the flat field, so on a newer
 * endpoint it silently resolved null and lapsed subscribers kept full access
 * forever. Read every known shape so the downgrade fires regardless of version.
 */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const flat = (invoice as { subscription?: string | { id: string } | null }).subscription;
  if (flat) return stripeId(flat);
  const parent = (invoice as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  }).parent;
  if (parent?.subscription_details?.subscription) return stripeId(parent.subscription_details.subscription);
  const line = invoice.lines?.data?.[0] as { subscription?: string | { id: string } | null } | undefined;
  if (line?.subscription) return stripeId(line.subscription);
  return null;
}
