/**
 * Read-only forensic dump for ONE account, for "my plan vanished" reports.
 *
 * Answers the only question that matters first: was the user's stored plan
 * actually changed, or did the CLIENT merely fail to read it? Prints every
 * Firebase auth identity matching the email (a second uid is its own class of
 * bug), the full user doc's billing/onboarding fields, the connected Google
 * accounts, and the live Stripe customers + subscriptions for that email.
 *
 *   cd apps/web && npx tsx scripts/diagnose-user-session.ts <email>
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

function app() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ts(v: any): string {
  if (v === undefined || v === null) return '—';
  try {
    const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  } catch { return String(v); }
}

async function main() {
  const email = process.argv[2];
  if (!email) { console.error('usage: npx tsx scripts/diagnose-user-session.ts <email>'); process.exit(1); }

  const auth = getAuth(app());
  const db = getFirestore(app());

  console.log(`\n=== FIREBASE AUTH IDENTITIES for ${email} ===`);
  // Scan the whole user list: getUserByEmail returns ONE record, and the failure
  // mode we're hunting for is a SECOND uid holding the same email.
  const uids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.email?.toLowerCase() === email.toLowerCase()) {
        uids.push(u.uid);
        console.log(`  uid=${u.uid}`);
        console.log(`    providers : ${u.providerData.map(p => p.providerId).join(', ') || '(none)'}`);
        console.log(`    created   : ${ts(u.metadata.creationTime)}`);
        console.log(`    lastSignIn: ${ts(u.metadata.lastSignInTime)}`);
        console.log(`    lastRefresh: ${ts((u.metadata as unknown as { lastRefreshTime?: string }).lastRefreshTime)}`);
        console.log(`    disabled  : ${u.disabled}   emailVerified: ${u.emailVerified}`);
        console.log(`    customClaims: ${JSON.stringify(u.customClaims ?? {})}`);
        console.log(`    tokensValidAfter: ${ts(u.tokensValidAfterTime)}`);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  if (!uids.length) console.log('  (no auth user with that email)');

  for (const uid of uids) {
    console.log(`\n=== FIRESTORE users/${uid} ===`);
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) { console.log('  (no user doc)'); continue; }
    const d = snap.data()!;
    const billing = ['plan', 'grandfathered', 'stripeCustomerId', 'stripeSubscriptionId',
      'subscriptionStatus', 'cadence', 'foundingMember', 'foundingCode', 'trialEndsAt',
      'onboardingComplete', 'modusPilotSignupAt', 'createdAt', 'updatedAt',
      'dailyMessages', 'usageDate', 'dailyTokens', 'tokenDate', 'weeklyTokens', 'tokenWeek'];
    for (const k of billing) {
      if (k in d) console.log(`  ${k.padEnd(21)}: ${typeof d[k] === 'object' ? ts(d[k]) : d[k]}`);
    }
    console.log(`  --- all top-level keys ---`);
    console.log(`  ${Object.keys(d).sort().join(', ')}`);

    const gaccts = await db.collection('users').doc(uid).collection('google_accounts').get();
    console.log(`\n  google_accounts (${gaccts.size}):`);
    for (const g of gaccts.docs) {
      const gd = g.data();
      console.log(`    ${g.id} | email=${gd.email} | connectedAt=${ts(gd.connectedAt)} | hasRefresh=${!!gd.refreshToken} | expiresAt=${ts(gd.expiresAt)}`);
    }

    for (const sub of ['conversations', 'memories', 'tasks', 'habits']) {
      const s = await db.collection('users').doc(uid).collection(sub).count().get();
      console.log(`  ${sub}: ${s.data().count}`);
    }
  }

  console.log(`\n=== STRIPE (live key: ${process.env.STRIPE_SECRET_KEY?.slice(0, 8)}…) ===`);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customers = await stripe.customers.list({ email, limit: 100 });
  console.log(`  customers matching email: ${customers.data.length}`);
  for (const c of customers.data) {
    console.log(`\n  customer ${c.id}  created=${ts(c.created * 1000)}  name=${c.name ?? '—'}`);
    console.log(`    metadata: ${JSON.stringify(c.metadata)}`);
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20 });
    if (!subs.data.length) console.log('    subscriptions: (none)');
    for (const s of subs.data) {
      const item = s.items.data[0];
      console.log(`    sub ${s.id}  status=${s.status}  created=${ts(s.created * 1000)}`);
      console.log(`      price=${item?.price?.id} ${((item?.price?.unit_amount ?? 0) / 100).toFixed(2)} ${item?.price?.currency} /${item?.price?.recurring?.interval}`);
      console.log(`      cancel_at_period_end=${s.cancel_at_period_end}  canceled_at=${s.canceled_at ? ts(s.canceled_at * 1000) : '—'}`);
      console.log(`      metadata: ${JSON.stringify(s.metadata)}`);
    }
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
