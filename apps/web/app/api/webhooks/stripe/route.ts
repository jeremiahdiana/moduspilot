import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendPushToUser } from '@/lib/fcm-admin';

const PLAN_PRICE: Record<string, string> = { modus: '$24', pilot: '$59', group: '$79' };

async function findUserBySubscription(subId: string, customerId: string | null, uid?: string | null) {
  if (uid) {
    const doc = await adminDb.collection('users').doc(uid).get();
    if (doc.exists) return doc.ref;
  }
  // Fallback: look up by subscriptionId
  let snap = await adminDb.collection('users').where('subscriptionId', '==', subId).limit(1).get();
  if (!snap.empty) return snap.docs[0].ref;
  // Fallback: look up by stripeCustomerId
  if (customerId) {
    snap = await adminDb.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!snap.empty) return snap.docs[0].ref;
  }
  return null;
}

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
    if (uid && (plan === 'modus' || plan === 'pilot' || plan === 'group')) {
      await adminDb.collection('users').doc(uid).update({
        plan,
        stripeCustomerId: session.customer,
        subscriptionId: session.subscription,
        trialReminderSent: false,
      });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const ref = await findUserBySubscription(sub.id, sub.customer as string | null, sub.metadata?.uid);
    if (!ref) return Response.json({ received: true });

    const plan = sub.metadata?.plan;
    const status = sub.status; // active, past_due, canceled, unpaid, etc.

    if (status === 'active' || status === 'trialing') {
      if (plan === 'modus' || plan === 'pilot' || plan === 'group') {
        await ref.update({ plan, subscriptionId: sub.id });
      }
    } else if (status === 'past_due' || status === 'unpaid' || status === 'paused') {
      await ref.update({ plan: 'free' });
    }
  }

  // Trial ending — notify the user before their card is charged. Stripe fires
  // this ~3 days before trial end (immediately for our 3-day trial, i.e. right
  // after signup), so it doubles as a clear "you'll be charged on X" heads-up
  // that reduces surprise charges + disputes. Delivered in-app + push (MODUS
  // has no transactional email provider).
  if (event.type === 'customer.subscription.trial_will_end') {
    const sub = event.data.object;
    const ref = await findUserBySubscription(sub.id, sub.customer as string | null, sub.metadata?.uid);
    if (!ref) return Response.json({ received: true });

    const snap = await ref.get();
    if (snap.data()?.trialReminderSent === true) return Response.json({ received: true });

    const plan = sub.metadata?.plan ?? 'modus';
    const price = PLAN_PRICE[plan] ?? '$24';
    const chargeDate = sub.trial_end
      ? new Date(sub.trial_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : 'soon';
    const body = `Your free trial ends ${chargeDate}. Unless you cancel first, your card will be charged ${price}/mo. Manage anytime in Settings → Billing.`;

    await Promise.all([
      ref.collection('conversations').add({
        title: 'Your trial is ending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        deleted: false,
        system: true,
        trialReminder: true,
        read: false,
        messages: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: 'assistant', content: body }],
      }),
      ref.update({ trialReminderSent: true }),
      sendPushToUser(ref.id, 'Your MODUS trial is ending', body).catch(() => {}),
    ]);
    return Response.json({ received: true });
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const ref = await findUserBySubscription(sub.id, sub.customer as string | null, sub.metadata?.uid);
    if (ref) await ref.update({ plan: 'free', subscriptionId: null });
  }

  // Downgrade on failed payment after all retries exhausted
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    // Only act when it's a subscription invoice and next_payment_attempt is null (retries done)
    if (invoice.subscription && invoice.next_payment_attempt === null) {
      const ref = await findUserBySubscription(
        invoice.subscription as string,
        invoice.customer as string | null,
        null,
      );
      if (ref) await ref.update({ plan: 'free' });
    }
  }

  return Response.json({ received: true });
}
