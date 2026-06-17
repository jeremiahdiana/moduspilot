import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  try {
    const snap = await adminDb.collection('users').doc(uid).collection('contacts').count().get();
    return Response.json({ count: snap.data().count });
  } catch {
    return Response.json({ count: 0 });
  }
}
