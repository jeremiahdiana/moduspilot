import { adminAuth } from '@/lib/firebase-admin';
import { getAllValidAccessTokens, getAllGoogleAccounts } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
import type { GmailThread } from '@/lib/google-gmail';

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ threads: [] });

  const { searchParams } = new URL(req.url);
  const accountFilter = searchParams.get('account') ?? null;
  const categoryFilter = (searchParams.get('filter') ?? 'primary') as 'primary' | 'all';

  try {
    const { uid } = await adminAuth.verifyIdToken(token);
    const allAccounts = await getAllValidAccessTokens(uid);
    const accountMeta = await getAllGoogleAccounts(uid);
    const needsReconnect = accountMeta.some(a => a.needsReconnect);

    if (allAccounts.length === 0) {
      // No usable tokens. Distinguish a genuinely disconnected user (no accounts)
      // from one whose token expired and just needs to reconnect — otherwise the
      // widget shows a silent empty inbox with no way to recover.
      return Response.json({
        threads: [],
        notConnected: accountMeta.length === 0,
        needsReconnect,
        accounts: accountMeta,
        accountCount: accountMeta.length,
      });
    }

    const targets = accountFilter
      ? allAccounts.filter(a => a.email === accountFilter)
      : allAccounts;

    const perAccountResults = await Promise.allSettled(
      targets.map(async ({ email, token: accessToken }) => {
        const threads = await getActionableThreads(accessToken, { filter: categoryFilter });
        return threads.map(t => ({ ...t, accountEmail: email }));
      }),
    );

    const allThreads: (GmailThread & { accountEmail: string })[] = [];
    for (const result of perAccountResults) {
      if (result.status === 'fulfilled') allThreads.push(...result.value);
    }

    const seen = new Set<string>();
    const deduped = allThreads
      .filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
      .slice(0, 20);

    return Response.json({
      threads: deduped,
      accounts: accountMeta,
      accountCount: accountMeta.length,
      connected: true,
      needsReconnect,
    });
  } catch (e) {
    console.error('[api/google/inbox]', e);
    return Response.json({ threads: [] });
  }
}
