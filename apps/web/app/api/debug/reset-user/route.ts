import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Temporary dev endpoint — delete this file after use
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = adminDb.collection('users').doc(uid);

    // Delete google_accounts subcollection
    const googleSnap = await userRef.collection('google_accounts').get();
    await Promise.all(googleSnap.docs.map(d => d.ref.delete()));

    // Delete legacy integrations/google doc
    await userRef.collection('integrations').doc('google').delete().catch(() => {});

    // Reset onboarding flag
    await userRef.set({ onboardingComplete: false }, { merge: true });

    return Response.json({ ok: true, uid, cleared: { googleAccounts: googleSnap.size } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
