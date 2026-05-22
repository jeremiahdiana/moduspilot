import { adminAuth } from '@/lib/firebase-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
import type { GmailThread } from '@/lib/google-gmail';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryFilter = (searchParams.get('filter') ?? 'all') as 'primary' | 'all';

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const accounts = await getAllValidAccessTokens(decoded.uid);

    if (accounts.length === 0) {
      return Response.json({ threads: [], connected: false });
    }

    // Fetch all inboxes in parallel
    const perAccountResults = await Promise.allSettled(
      accounts.map(async ({ email, token: accessToken }) => {
        const threads = await getActionableThreads(accessToken, { filter: categoryFilter });
        // Tag each thread with which account it came from
        return threads.map(t => ({ ...t, accountEmail: email }));
      }),
    );

    // Merge fulfilled results, sort by recency (threads already sorted by snippet date)
    const allThreads: (GmailThread & { accountEmail: string })[] = [];
    for (const result of perAccountResults) {
      if (result.status === 'fulfilled') {
        allThreads.push(...result.value);
      }
    }

    // Dedupe by thread id, cap at 15 total
    const seen = new Set<string>();
    const dedupedThreads = allThreads.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    }).slice(0, 15);

    return Response.json({ threads: dedupedThreads, connected: true, accountCount: accounts.length });
  } catch (e) {
    console.error('[integrations/gmail]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
