import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FOUNDING_COOKIE, verifyGate, toMillis } from '@/lib/founding';

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

  // One-time claim, reusable entry: flip available -> claimed for THIS uid.
  // If already claimed by this same uid, allow resume (they abandoned checkout).
  const codeRef = adminDb.collection('foundingCodes').doc(codeId);
  try {
    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(codeRef);
      const data = snap.data() as { status?: string; claimedByUid?: string; expiresAt?: unknown } | undefined;
      if (!data) throw new Error('code-missing');
      if (data.status === 'claimed') {
        if (data.claimedByUid !== uid) throw new Error('already-claimed');
        return; // resume own claim — a claimed key never expires out from under a member
      }
      // Unclaimed + past expiry: the 30-day gate cookie can outlive the key, so
      // the claim is the last line of defence. Block it here, not just at /enter.
      const expMs = toMillis(data.expiresAt);
      if (expMs != null && Date.now() > expMs) throw new Error('expired');
      tx.update(codeRef, {
        status: 'claimed',
        claimedByUid: uid,
        claimedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'already-claimed') return Response.json({ error: 'This founding spot has already been claimed.', code: 'already_claimed' }, { status: 409 });
    if (msg === 'expired') return Response.json({ error: 'This invitation has expired.', code: 'expired' }, { status: 410 });
    if (msg === 'code-missing') return Response.json({ error: 'That founding key no longer exists.' }, { status: 404 });
    return Response.json({ error: 'Could not claim your spot. Try again.' }, { status: 500 });
  }

  // Reuse an existing Stripe customer if present.
  const userDoc = await adminDb.collection('users').doc(uid).get();
  const existingCustomerId = userDoc.data()?.stripeCustomerId as string | undefined;
  const existingSubId = userDoc.data()?.subscriptionId as string | undefined;
  const currentPlan = userDoc.data()?.plan as string | undefined;

  // Already an active subscriber (e.g. they finished checkout, then revisited):
  // don't double-bill — just send them into the app.
  if (existingSubId && currentPlan && currentPlan !== 'free') {
    return Response.json({ alreadyActive: true, url: `${APP_URL}/welcome` });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: FOUNDING_PRICE, quantity: 1 }],
    success_url: `${APP_URL}/welcome`,
    cancel_url: `${APP_URL}/grandfathering`,
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: email }),
    // Founders are charged $24 immediately (no trial). The webhook reads
    // metadata.plan ('pilot') — NOT the price — so this $24 sub grants PILOT.
    subscription_data: {
      metadata: { uid, plan: FOUNDING_PLAN, founding: 'true' },
    },
    payment_method_collection: 'always',
    metadata: { uid, plan: FOUNDING_PLAN, founding: 'true' },
  });

  return Response.json({ url: session.url });
}
