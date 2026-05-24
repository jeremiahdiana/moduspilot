import { adminAuth } from '@/lib/firebase-admin';
import { getNotionAccounts } from '@/lib/notion-oauth';
import { getSlackAccounts } from '@/lib/slack-oauth';
import { getGitHubAccounts } from '@/lib/github-oauth';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const [notion, slack, github] = await Promise.all([
      getNotionAccounts(decoded.uid),
      getSlackAccounts(decoded.uid),
      getGitHubAccounts(decoded.uid),
    ]);
    return Response.json({ notion, slack, github });
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
