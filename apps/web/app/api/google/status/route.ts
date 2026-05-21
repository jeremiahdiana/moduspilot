import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ connected: false });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('integrations').doc('google')
      .get();

    if (!snap.exists) return Response.json({ connected: false });

    const data = snap.data()!;
    return Response.json({
      connected: true,
      email: data.email ?? '',
      connectedAt: data.connectedAt?.toDate?.()?.toISOString() ?? null,
    });
  } catch {
    return Response.json({ connected: false });
  }
}
