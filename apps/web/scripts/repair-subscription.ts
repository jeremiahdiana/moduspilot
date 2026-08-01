/**
 * Reconcile a user's Firestore plan against the TRUTH in Stripe.
 *
 * For when someone really paid but the webhook didn't land — e.g. they paid
 * BEFORE onboarding created their users doc, so checkout.session.completed hit
 * `5 NOT_FOUND: No document to update` and 500'd (fixed in the webhook by
 * switching to set+merge, but this repairs anyone already stranded).
 *
 *   cd apps/web && npx tsx scripts/repair-subscription.ts <email-or-uid>          # dry run
 *   cd apps/web && npx tsx scripts/repair-subscription.ts <email-or-uid> --apply  # write
 *
 * Reads the user's ACTIVE Stripe subscription, and applies exactly what the
 * webhook would have: plan/stripeCustomerId/subscriptionId (+founding, +seat
 * claim) — never inventing a plan Stripe doesn't show as paid and active.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const WHO = process.argv[2];
const APPLY = process.argv.includes('--apply');

if (!WHO) {
  console.error('Usage: npx tsx scripts/repair-subscription.ts <email-or-uid> [--apply]');
  process.exit(1);
}

async function main() {
  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
  const { stripe } = await import('@/lib/stripe');
  const { FieldValue } = await import('firebase-admin/firestore');

  // Resolve to a uid + email via Firebase Auth.
  let uid: string, email: string | undefined;
  try {
    const u = WHO.includes('@') ? await adminAuth.getUserByEmail(WHO) : await adminAuth.getUser(WHO);
    uid = u.uid; email = u.email ?? undefined;
  } catch (e: any) {
    console.error(`No Firebase Auth user for "${WHO}": ${e.message}`);
    process.exit(1);
  }
  console.log(`user  uid=${uid}  email=${email}\n`);

  const before = (await adminDb.collection('users').doc(uid).get()).data() as any;
  console.log(`firestore BEFORE: exists=${!!before} plan=${before?.plan ?? '—'} ` +
              `stripeCustomerId=${before?.stripeCustomerId ?? '—'} subscriptionId=${before?.subscriptionId ?? '—'} ` +
              `founding=${before?.founding ?? '—'}`);

  // Find the live subscription: prefer metadata.uid, fall back to customer email.
  const customers = email ? (await stripe.customers.list({ email, limit: 20 })).data : [];
  const subs: any[] = [];
  for (const c of customers) {
    const s = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20 });
    subs.push(...s.data);
  }
  const live = subs.filter(s => (s.status === 'active' || s.status === 'trialing') && s.metadata?.uid === uid);

  console.log(`\nstripe: ${customers.length} customer(s), ${subs.length} subscription(s), ${live.length} active-for-this-uid`);
  for (const s of subs) {
    console.log(`   ${s.id}  ${s.status}  cust=${s.customer}  plan=${s.metadata?.plan ?? '—'}  founding=${s.metadata?.founding ?? '—'}`);
  }

  if (live.length === 0) {
    console.log('\n❌ No ACTIVE subscription in Stripe for this uid — nothing to repair. Not granting a plan.');
    process.exit(1);
  }
  if (live.length > 1) {
    console.log('\n⚠️  MORE THAN ONE active subscription — this user may be double-billed. Refund/cancel the extra in Stripe first.');
  }

  const sub = live[0];
  const plan = sub.metadata?.plan;
  if (plan !== 'modus' && plan !== 'pilot' && plan !== 'group') {
    console.log(`\n❌ Subscription metadata.plan is "${plan}" — not a plan we grant. Aborting.`);
    process.exit(1);
  }

  const patch: Record<string, unknown> = {
    plan,
    stripeCustomerId: sub.customer,
    subscriptionId: sub.id,
    trialReminderSent: false,
    ...(sub.metadata?.founding === 'true' ? { founding: true } : {}),
  };
  const codeId: string | undefined = sub.metadata?.founding === 'true' ? sub.metadata?.foundingCodeId : undefined;

  console.log(`\nwould write to users/${uid}:`);
  for (const [k, v] of Object.entries(patch)) console.log(`   ${k} = ${v}`);
  if (codeId) console.log(`would claim foundingCodes/${codeId} for this uid`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.');
    process.exit(0);
  }

  // Exactly what the webhook does, set+merge so a missing doc is created.
  await adminDb.collection('users').doc(uid).set(patch, { merge: true });
  console.log(`\n✅ wrote users/${uid}`);

  if (codeId) {
    const codeRef = adminDb.collection('foundingCodes').doc(codeId);
    await adminDb.runTransaction(async tx => {
      const d = (await tx.get(codeRef)).data() as { status?: string; claimedByUid?: string } | undefined;
      if (!d) { console.log('⚠️  founding code missing — skipped'); return; }
      if (d.status === 'claimed' && d.claimedByUid !== uid) {
        console.log(`⚠️  seat already claimed by ${d.claimedByUid} — left alone`); return;
      }
      tx.update(codeRef, { status: 'claimed', claimedByUid: uid, claimedAt: FieldValue.serverTimestamp() });
    });
    const after = (await codeRef.get()).data() as any;
    console.log(`✅ founding seat #${after?.foundingNumber} (${after?.label}) → ${after?.status} by ${after?.claimedByUid}`);
  }

  const v = (await adminDb.collection('users').doc(uid).get()).data() as any;
  console.log(`\nfirestore AFTER: plan=${v?.plan} stripeCustomerId=${v?.stripeCustomerId} subscriptionId=${v?.subscriptionId} founding=${v?.founding}`);
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
