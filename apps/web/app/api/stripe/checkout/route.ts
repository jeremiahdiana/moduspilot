import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { TRIAL_DAYS } from '@/lib/constants';
import { isCadence, resolvePlanPrice, type Cadence } from '@/lib/pricing';
import { ensureUserDoc, resolveStripeCustomer, findLivePlanSubscription, stripeId } from '@/lib/billing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.moduspilot.com';

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

  const { plan, returnTo, cadence: rawCadence, quantity: rawQuantity } = await req.json() as {
    plan: string; returnTo?: string; cadence?: string; quantity?: number;
  };
  const requested: Cadence = isCadence(rawCadence) ? rawCadence : 'monthly';
  const { priceId, cadence } = resolvePlanPrice(plan, requested);
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  // The limits add-on is a TOP-UP, not a plan: it grants no access on its own and
  // stacks by Stripe subscription quantity. It therefore takes the opposite path
  // through the duplicate-subscription guard below — it REQUIRES an existing plan
  // instead of being blocked by one.
  const isAddon = plan === 'limitAddon';
  const quantity = isAddon ? Math.min(20, Math.max(1, Math.floor(Number(rawQuantity) || 1))) : 1;

  // Never let a later write hit `5 NOT_FOUND` on a users doc that doesn't exist yet.
  await ensureUserDoc(uid, email);

  // Guard: an active subscriber must NOT get a second (trialing) subscription
  // here — that would double-bill them and grant a fresh trial. Plan changes go
  // through /api/stripe/change-plan, which reprices the existing subscription.
  //
  // This asks STRIPE, not our Firestore mirror. The mirror is only written by the
  // success webhook, so it reads "no subscription" exactly when the webhook failed
  // — the one moment this guard has to work. Firestore-based checking is how a
  // founder ended up paying twice.
  //
  // 🪤 ADD-ONS ARE EXCLUDED FROM BOTH SIDES OF THIS. An add-on must not look like
  // "you already have a subscription" when someone is buying a real plan, and a
  // real plan is exactly what an add-on purchase requires.
  const livePlanSub = await findLivePlanSubscription(uid, email);

  if (isAddon) {
    if (!livePlanSub) {
      return Response.json(
        { error: 'Start a plan before adding extra limits.', code: 'needs_plan' },
        { status: 400 },
      );
    }
  } else if (livePlanSub) {
    // Self-heal the mirror so the user isn't stuck behind a stale paywall.
    const livePlan = livePlanSub.metadata?.plan;
    await adminDb.collection('users').doc(uid).set({
      subscriptionId: livePlanSub.id,
      stripeCustomerId: stripeId(livePlanSub.customer),
      ...(livePlan === 'modus' || livePlan === 'pilot' || livePlan === 'group' ? { plan: livePlan } : {}),
    }, { merge: true });
    return Response.json(
      { error: 'You already have an active subscription. Use plan change instead.', code: 'has_subscription' },
      { status: 409 },
    );
  }

  // Resolve + PERSIST the customer up front, so a retry reuses it instead of
  // minting a second customer (and, with it, a second subscription).
  const existingCustomerId = await resolveStripeCustomer(uid, email);

  // Optional post-checkout destination (e.g. new users land on the dashboard
  // after starting their trial; billing changes stay in settings).
  const successUrl = returnTo === 'dashboard'
    ? `${APP_URL}/dashboard?trial_started=1`
    : `${APP_URL}/settings?tab=billing&upgraded=1`;

  // Abandoning checkout must not dead-end an account-only user with no access:
  // from onboarding (returnTo=dashboard), send them back to the plan/Start step
  // (?trial=1) so it's one tap to retry. Settings upgrades return to settings.
  const cancelUrl = returnTo === 'dashboard'
    ? `${APP_URL}/onboarding?trial=1`
    : `${APP_URL}/settings?tab=billing`;

  // 🚨 ADD-ON METADATA CARRIES NO `plan` KEY, DELIBERATELY.
  //
  // The webhook grants access on `isGrantablePlan(sub.metadata.plan)`. Stamping
  // plan:'limitAddon' would fail that check today, but the safer property is that
  // there is nothing there to accidentally start matching — and `addon` is the
  // positive signal isAddonSubscription() keys off, which is what keeps a
  // cancelled plan from being "kept alive" by a $10 add-on.
  const subMetadata: Stripe.MetadataParam = isAddon
    ? { uid, addon: 'limits', cadence }
    : { uid, plan, cadence };

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    price: priceId,
    quantity,
    // Let people change how many add-ons they hold from Stripe's own page.
    ...(isAddon ? { adjustable_quantity: { enabled: true, minimum: 1, maximum: 20 } } : {}),
  };

  // Card required now; MODUS is billed after the 3-day trial. Stripe fires
  // checkout.session.completed + a `trialing` subscription (handled in the
  // webhook → plan set immediately), then auto-charges when the trial ends.
  //
  // The add-on gets NO trial: it is bought by someone who already pays and wants
  // headroom now, and a 3-day free boost is a free-usage loophole (buy → burn →
  // cancel, repeatedly).
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    // `cadence` is the one that was actually resolved, not the one requested —
    // an annual request for a monthly-only plan is recorded as monthly.
    metadata: subMetadata,
  };
  if (!isAddon) {
    subscriptionData.trial_period_days = TRIAL_DAYS;
    subscriptionData.trial_settings = { end_behavior: { missing_payment_method: 'cancel' } };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [lineItem],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: existingCustomerId,
    subscription_data: subscriptionData,
    payment_method_collection: 'always',
    metadata: subMetadata,
  });

  return Response.json({ url: session.url });
}
