import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const plan = session.metadata?.plan;
    if (uid && (plan === 'modus' || plan === 'pilot')) {
      await adminDb.collection('users').doc(uid).update({
        plan,
        stripeCustomerId: session.customer,
        subscriptionId: session.subscription,
      });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const uid = sub.metadata?.uid;
    const plan = sub.metadata?.plan;
    if (uid && (plan === 'modus' || plan === 'pilot')) {
      await adminDb.collection('users').doc(uid).update({ plan });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const uid = sub.metadata?.uid;
    if (uid) {
      await adminDb.collection('users').doc(uid).update({ plan: 'free', subscriptionId: null });
    } else {
      // Fallback: look up by subscriptionId
      const snap = await adminDb.collection('users')
        .where('subscriptionId', '==', sub.id)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ plan: 'free', subscriptionId: null });
      }
    }
  }

  return Response.json({ received: true });
}
