import { adminAuth } from '@/lib/firebase-admin';
import { disconnectGoogle } from '@/lib/google-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    await disconnectGoogle(uid);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
