// READ ONLY. Counts what the reconcile would find on the real account.
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

async function main() {
  const { adminDb } = await import('@/lib/firebase-admin');
  const { initializeApp, getApps, getApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
  const users = await getAuth(app).listUsers(1000);
  console.log(`${users.users.length} auth accounts\n`);

  for (const u of users.users) {
    const [notes, messages, tasks] = await Promise.all([
      adminDb.collection('users').doc(u.uid).collection('notes').count().get(),
      adminDb.collection('users').doc(u.uid).collection('messages').count().get(),
      adminDb.collection('users').doc(u.uid).collection('tasks').where('source', '==', 'apple-reminders').get(),
    ]);
    const n = notes.data().count;
    const m = messages.data().count;
    const appleTasks = tasks.docs.length;
    const softDeleted = tasks.docs.filter((d) => d.data().deleted === true).length;
    if (n === 0 && m === 0 && appleTasks === 0) continue;
    console.log(`${u.email ?? u.uid}`);
    console.log(`  notes=${n}  messages=${m}  apple tasks=${appleTasks} (${softDeleted} soft-deleted)`);
    if (n > 0) {
      // Would the mass-delete breaker fire if 46 notes are live locally?
      const wouldDelete = Math.max(0, n - 46);
      const trips = wouldDelete > 100 && wouldDelete > 0.5 * n;
      console.log(`  first reconcile vs 46 live local notes: ~${wouldDelete} deletes → breaker ${trips ? 'FIRES (held, needs a look)' : 'does not fire'}`);
    }
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
