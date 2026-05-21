import { adminAuth } from '@/lib/firebase-admin';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const accessToken = await getValidAccessToken(decoded.uid);
    if (!accessToken) return Response.json({ threads: [], connected: false });

    const threads = await getActionableThreads(accessToken);
    return Response.json({ threads, connected: true });
  } catch (e) {
    console.error('[integrations/gmail]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
