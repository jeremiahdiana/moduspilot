import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { TRIAL_DAYS } from '@/lib/constants';
import { PRICE_ENV, isCadence, type Cadence } from '@/lib/pricing';
import { ensureUserDoc, resolveStripeCustomer, findLiveSubscription, stripeId } from '@/lib/billing';

/**
 * Resolve plan + cadence to a Stripe price. Annual falls back to monthly when no
 * annual price exists (Group), and when the env var is missing — better to bill
 * the cadence we can actually honour than to 400 someone out of checkout.
 */
function resolvePrice(plan: string, cadence: Cadence): { priceId?: string; cadence: Cadence } {
  const envs = PRICE_ENV[plan];
  if (!envs) return { cadence };

  if (cadence === 'annual' && envs.annual) {
    const annual = process.env[envs.annual];
    if (annual) return { priceId: annual, cadence: 'annual' };
  }
  return { priceId: envs.monthly ? process.env[envs.monthly] : undefined, cadence: 'monthly' };
}

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

  const { plan, returnTo, cadence: rawCadence } = await req.json() as {
    plan: string; returnTo?: string; cadence?: string;
  };
  const requested: Cadence = isCadence(rawCadence) ? rawCadence : 'monthly';
  const { priceId, cadence } = resolvePrice(plan, requested);
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

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
  const live = await findLiveSubscription(uid, email);
  if (live) {
    // Self-heal the mirror so the user isn't stuck behind a stale paywall.
    const livePlan = live.metadata?.plan;
    await adminDb.collection('users').doc(uid).set({
      subscriptionId: live.id,
      stripeCustomerId: stripeId(live.customer),
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: existingCustomerId,
    // Card required now; MODUS is billed after the 3-day trial. Stripe fires
    // checkout.session.completed + a `trialing` subscription (handled in the
    // webhook → plan set immediately), then auto-charges when the trial ends.
    subscription_data: {
      // `cadence` is the one that was actually resolved, not the one requested —
      // an annual request for a monthly-only plan is recorded as monthly.
      metadata: { uid, plan, cadence },
      trial_period_days: TRIAL_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    payment_method_collection: 'always',
    metadata: { uid, plan, cadence },
  });

  return Response.json({ url: session.url });
}
