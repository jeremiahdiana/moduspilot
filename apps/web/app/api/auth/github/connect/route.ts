import { adminAuth } from '@/lib/firebase-admin';
import { buildGitHubOAuthUrl } from '@/lib/github-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const url = buildGitHubOAuthUrl(decoded.uid);
    return Response.json({ url });
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
