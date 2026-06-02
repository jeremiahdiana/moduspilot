import { adminAuth } from '@/lib/firebase-admin';
import { disconnectGoogleAccount, disconnectGoogle } from '@/lib/google-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const body = await req.json().catch(() => ({}));

    if (body.email) {
      // Disconnect a specific account
      await disconnectGoogleAccount(uid, body.email);
    } else {
      // Disconnect all accounts
      await disconnectGoogle(uid);
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[google/disconnect]', String(e));
    return Response.json({ error: 'Disconnect failed' }, { status: 500 });
  }
}
