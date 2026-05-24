import { adminAuth } from '@/lib/firebase-admin';
import { disconnectGitHubAccount } from '@/lib/github-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const { login } = await req.json();
    if (!login) return Response.json({ error: 'Missing login' }, { status: 400 });
    await disconnectGitHubAccount(decoded.uid, login);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
