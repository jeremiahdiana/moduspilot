/**
 * Profile every MODUS account: who signed up, who pays, who actually uses it.
 * Read-only. Prints a per-account row + what separates the payer from the rest.
 *
 *   cd apps/web && npx tsx scripts/accounts-profile.ts
 *   cd apps/web && npx tsx scripts/accounts-profile.ts --schema   # dump raw field names
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

const SUBCOLS = [
  'conversations', 'messages', 'memories', 'notes', 'tasks', 'goals',
  'habits', 'projects', 'connectors', 'jobs', 'contacts',
];

function ts(v: any): string {
  if (!v) return '—';
  try {
    const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 24);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch { return String(v).slice(0, 24); }
}

async function main() {
  const schemaOnly = process.argv.includes('--schema');
  const { adminDb } = await import('@/lib/firebase-admin');

  const users = await adminDb.collection('users').get();
  console.log(`\n=== ${users.size} user docs in Firestore ===\n`);

  if (schemaOnly) {
    for (const u of users.docs) {
      console.log(`--- ${u.id} ---`);
      console.log(JSON.stringify(u.data(), null, 2).slice(0, 3000));
      const subs = await u.ref.listCollections();
      console.log('subcollections:', subs.map((c) => c.id).join(', ') || '(none)');
      console.log();
    }
    return;
  }

  const rows: any[] = [];
  for (const u of users.docs) {
    const d: any = u.data();
    const counts: Record<string, number> = {};
    for (const name of SUBCOLS) {
      try {
        const snap = await u.ref.collection(name).count().get();
        const n = snap.data().count;
        if (n > 0) counts[name] = n;
      } catch { /* collection may not exist */ }
    }

    // Newest conversation = the real "last active" signal.
    let lastConvo = '—';
    let convoTitles: string[] = [];
    try {
      const cs = await u.ref.collection('conversations')
        .orderBy('updatedAt', 'desc').limit(5).get();
      if (!cs.empty) {
        lastConvo = ts(cs.docs[0].data().updatedAt);
        convoTitles = cs.docs.map((c) => String((c.data() as any).title ?? '').slice(0, 60)).filter(Boolean);
      }
    } catch { /* no updatedAt index */ }

    rows.push({
      uid: u.id,
      email: d.email ?? d.profile?.email ?? '—',
      name: d.displayName ?? d.name ?? '—',
      created: ts(d.createdAt ?? d.metadata?.createdAt),
      plan: d.plan ?? d.subscription?.plan ?? d.tier ?? '—',
      status: d.subscription?.status ?? d.subscriptionStatus ?? '—',
      stripe: d.stripeCustomerId ?? d.subscription?.customerId ?? '—',
      model: d.settings?.modelSettings?.model ?? '—',
      counts,
      lastConvo,
      convoTitles,
    });
  }

  rows.sort((a, b) => (b.counts.conversations ?? 0) - (a.counts.conversations ?? 0));

  for (const r of rows) {
    const paying = r.status !== '—' || (r.plan !== '—' && r.plan !== 'free');
    console.log(`${paying ? '💰' : '  '} ${r.email}  (${r.uid})`);
    console.log(`     name=${r.name}  created=${r.created}  lastConvo=${r.lastConvo}`);
    console.log(`     plan=${r.plan}  status=${r.status}  stripe=${r.stripe !== '—' ? 'yes' : '—'}  brain=${r.model}`);
    console.log(`     usage: ${Object.entries(r.counts).map(([k, v]) => `${k}=${v}`).join('  ') || '(nothing)'}`);
    if (r.convoTitles.length) console.log(`     recent: ${r.convoTitles.map((t: string) => `"${t}"`).join(', ')}`);
    console.log();
  }

  const payers = rows.filter((r) => r.status !== '—' || (r.plan !== '—' && r.plan !== 'free'));
  const free = rows.filter((r) => !payers.includes(r));
  console.log(`=== ${payers.length} paying / ${rows.length} total ===`);
  console.log(`payer conversations:  ${payers.map((r) => r.counts.conversations ?? 0).join(', ') || '—'}`);
  console.log(`non-payer convos:     ${free.map((r) => r.counts.conversations ?? 0).join(', ') || '—'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
