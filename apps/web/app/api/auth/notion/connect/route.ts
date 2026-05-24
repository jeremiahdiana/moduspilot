import { adminAuth } from '@/lib/firebase-admin';
import { buildNotionOAuthUrl } from '@/lib/notion-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await req.json().catch(() => ({}));
    const origin = body?.origin ?? 'settings';
    const url = buildNotionOAuthUrl(decoded.uid, origin);
    return Response.json({ url });
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
