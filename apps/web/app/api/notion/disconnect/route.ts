import { adminAuth } from '@/lib/firebase-admin';
import { disconnectNotionWorkspace } from '@/lib/notion-oauth';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const { workspaceId } = await req.json();
    if (!workspaceId) return Response.json({ error: 'Missing workspaceId' }, { status: 400 });
    await disconnectNotionWorkspace(decoded.uid, workspaceId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
