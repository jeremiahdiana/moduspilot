import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendPushToUser } from '@/lib/fcm-admin';

const PLAN_PRICE: Record<string, string> = { modus: '$24', pilot: '$59', group: '$79' };

// When a subscription ends or lapses, the pending "your trial ends, you'll be
// charged $X" heads-up is no longer true — retract it so canceled users don't
// see a stale charge warning (a source of confusion + disputes). Also reset the
// sent flag so a future trial can notify again.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clearTrialReminders(ref: FirebaseFirestore.DocumentReference) {
  const snap = await ref.collection('conversations').where('trialReminder', '==', true).get();
  if (snap.empty) return;
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  await ref.update({ trialReminderSent: false });
}

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
      // set+merge, NOT update: a user can pay BEFORE the users doc exists (sign in
      // with Google → straight to /grandfathering → pay, all before onboarding
      // completes, which is what actually creates the doc). update() throws
      // 5 NOT_FOUND on a missing doc, so the webhook 500'd and a real founder was
      // left paid-but-on-no-plan. merge creates it and is still idempotent on retry.
      await adminDb.collection('users').doc(uid).set({
        plan,
        stripeCustomerId: session.customer,
        subscriptionId: session.subscription,
        trialReminderSent: false,
        ...(session.metadata?.founding === 'true' ? { founding: true } : {}),
      }, { merge: true });

      // Founding: the seat is claimed HERE — on successful payment — never at
      // checkout creation. So abandoning the Stripe page never consumes a seat.
      // Best-effort: the plan grant above is what matters. A claim hiccup must not
      // throw (Stripe would retry the whole event and re-grant); already-claimed
      // is a no-op (webhook retry, or the vanishingly rare two-payers race — the
      // second payer still got their plan above, just not the seat number).
      const foundingCodeId = session.metadata?.foundingCodeId;
      if (session.metadata?.founding === 'true' && foundingCodeId) {
        try {
          const codeRef = adminDb.collection('foundingCodes').doc(foundingCodeId);
          await adminDb.runTransaction(async tx => {
            const data = (await tx.get(codeRef)).data() as { status?: string } | undefined;
            if (!data || data.status === 'claimed') return;
            tx.update(codeRef, { status: 'claimed', claimedByUid: uid, claimedAt: FieldValue.serverTimestamp() });
          });
        } catch (e) {
          console.error('founding: claim-on-payment failed', foundingCodeId, uid, e);
        }
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const ref = await findUserBySubscription(sub.id, sub.customer as string | null, sub.metadata?.uid);
    const plan = sub.metadata?.plan;
    const status = sub.status; // active, past_due, canceled, unpaid, etc.

    // This handler is the safety net for a paid sub whose checkout.session.completed
    // didn't land. findUserBySubscription returns null when the users doc doesn't
    // exist yet (paid before onboarding), which used to make this silently 200 and
    // leave a payer on no plan. Our own metadata.uid is trustworthy, so grant on it.
    if (!ref) {
      const uid = sub.metadata?.uid;
      if (uid && (status === 'active' || status === 'trialing') &&
          (plan === 'modus' || plan === 'pilot' || plan === 'group')) {
        await adminDb.collection('users').doc(uid).set({
          plan,
          subscriptionId: sub.id,
          stripeCustomerId: sub.customer,
          ...(sub.metadata?.founding === 'true' ? { founding: true } : {}),
        }, { merge: true });
      }
      return Response.json({ received: true });
    }

    if (status === 'active' || status === 'trialing') {
      if (plan === 'modus' || plan === 'pilot' || plan === 'group') {
        await ref.update({ plan, subscriptionId: sub.id });
      }
    } else if (status === 'past_due' || status === 'unpaid' || status === 'paused') {
      await ref.update({ plan: 'free' });
      await clearTrialReminders(ref);
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
    if (ref) {
      await ref.update({ plan: 'free', subscriptionId: null });
      await clearTrialReminders(ref);
    }
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
      if (ref) {
        await ref.update({ plan: 'free' });
        await clearTrialReminders(ref);
      }
    }
  }

  return Response.json({ received: true });
}
