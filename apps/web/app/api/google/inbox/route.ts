import { adminAuth } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ threads: [] });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const googleToken = await getValidAccessToken(uid);
    if (!googleToken) return Response.json({ threads: [], notConnected: true });

    const threads = await getActionableThreads(googleToken);
    return Response.json({ threads: threads.slice(0, 5) });
  } catch (e) {
    console.error('[api/google/inbox]', e);
    return Response.json({ threads: [] });
  }
}
