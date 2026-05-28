import { adminAuth } from '@/lib/firebase-admin';
import { getValidAccessToken, getAllValidAccessTokens } from '@/lib/google-oauth';
import { getTodayEvents } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ events: [] });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const account = new URL(req.url).searchParams.get('account') ?? '';

    let googleToken: string | null = null;
    if (account) {
      const all = await getAllValidAccessTokens(uid);
      googleToken = all.find(a => a.email === account)?.token ?? null;
    } else {
      googleToken = await getValidAccessToken(uid);
    }

    if (!googleToken) return Response.json({ events: [], connected: false });
    const tz = new URL(req.url).searchParams.get('tz') ?? 'UTC';
    const events = await getTodayEvents(googleToken, tz);
    return Response.json({ events: events.filter(e => !e.allDay), connected: true });
  } catch (e) {
    console.error('[api/google/today]', e);
    return Response.json({ events: [] });
  }
}
