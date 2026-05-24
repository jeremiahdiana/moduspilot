import { adminAuth } from '@/lib/firebase-admin';
import { getValidAccessToken, getAllValidAccessTokens } from '@/lib/google-oauth';
import { getTodayEvents } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const url = new URL(req.url);
    const tz = url.searchParams.get('tz') ?? 'UTC';
    const account = url.searchParams.get('account') ?? '';

    let accessToken: string | null = null;
    if (account) {
      const all = await getAllValidAccessTokens(decoded.uid);
      accessToken = all.find(a => a.email === account)?.token ?? null;
    } else {
      accessToken = await getValidAccessToken(decoded.uid);
    }

    if (!accessToken) return Response.json({ events: [], connected: false });
    const events = await getTodayEvents(accessToken, tz);
    return Response.json({ events, connected: true });
  } catch (e) {
    console.error('[integrations/calendar]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
