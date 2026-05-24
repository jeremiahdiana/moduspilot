import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function deleteSubcollection(userRef: FirebaseFirestore.DocumentReference, name: string) {
  const snap = await userRef.collection(name).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  return snap.size;
}

// Temporary dev endpoint — delete this file after use
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = adminDb.collection('users').doc(uid);

    const [google, integrations, goals, habits, tasks, conversations, memories, contacts] = await Promise.all([
      deleteSubcollection(userRef, 'google_accounts'),
      deleteSubcollection(userRef, 'integrations'),
      deleteSubcollection(userRef, 'goals'),
      deleteSubcollection(userRef, 'habits'),
      deleteSubcollection(userRef, 'tasks'),
      deleteSubcollection(userRef, 'conversations'),
      deleteSubcollection(userRef, 'memories'),
      deleteSubcollection(userRef, 'contacts'),
    ]);

    await userRef.set({ onboardingComplete: false }, { merge: true });

    return Response.json({ ok: true, uid, cleared: { google, integrations, goals, habits, tasks, conversations, memories, contacts } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
