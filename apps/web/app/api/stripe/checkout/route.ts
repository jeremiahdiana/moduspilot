import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { TRIAL_DAYS } from '@/lib/constants';

const PRICE_IDS: Record<string, string | undefined> = {
  modus: process.env.STRIPE_PRICE_MODUS,
  pilot: process.env.STRIPE_PRICE_PILOT,
  group: process.env.STRIPE_PRICE_GROUP,
};

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

  const { plan, returnTo } = await req.json() as { plan: string; returnTo?: string };
  const priceId = PRICE_IDS[plan];
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  // Reuse existing Stripe customer if one exists
  const userDoc = await adminDb.collection('users').doc(uid).get();
  const existingCustomerId = userDoc.data()?.stripeCustomerId as string | undefined;

  // Guard: an active subscriber must NOT get a second (trialing) subscription
  // here — that would double-bill them and grant a fresh trial. Plan changes go
  // through /api/stripe/change-plan, which reprices the existing subscription.
  const existingSubId = userDoc.data()?.subscriptionId as string | undefined;
  const currentPlan = userDoc.data()?.plan as string | undefined;
  if (existingSubId && currentPlan && currentPlan !== 'free') {
    return Response.json(
      { error: 'You already have an active subscription. Use plan change instead.', code: 'has_subscription' },
      { status: 409 },
    );
  }

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
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: email }),
    // Card required now; MODUS is billed after the 3-day trial. Stripe fires
    // checkout.session.completed + a `trialing` subscription (handled in the
    // webhook → plan set immediately), then auto-charges when the trial ends.
    subscription_data: {
      metadata: { uid, plan },
      trial_period_days: TRIAL_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    payment_method_collection: 'always',
    metadata: { uid, plan },
  });

  return Response.json({ url: session.url });
}
