import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const PRICE_IDS: Record<string, string | undefined> = {
  modus: process.env.STRIPE_PRICE_MODUS,
  pilot: process.env.STRIPE_PRICE_PILOT,
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

  const { plan } = await req.json() as { plan: string };
  const priceId = PRICE_IDS[plan];
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  // Reuse existing Stripe customer if one exists
  const userDoc = await adminDb.collection('users').doc(uid).get();
  const existingCustomerId = userDoc.data()?.stripeCustomerId as string | undefined;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings?tab=billing&upgraded=1`,
    cancel_url: `${APP_URL}/settings?tab=billing`,
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: email }),
    metadata: { uid, plan },
    subscription_data: { metadata: { uid, plan } },
  });

  return Response.json({ url: session.url });
}
