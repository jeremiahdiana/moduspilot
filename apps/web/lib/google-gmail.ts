export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  unread: boolean;
}

export async function getActionableThreads(accessToken: string): Promise<GmailThread[]> {
  try {
    const since = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000);
    const query = `in:inbox is:unread after:${since}`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) return [];

    const listData = await listRes.json();
    const threads: { id: string }[] = listData.threads ?? [];
    const results: GmailThread[] = [];

    for (const t of threads.slice(0, 5)) {
      try {
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!threadRes.ok) continue;

        const threadData = await threadRes.json();
        const msg = threadData.messages?.[0];
        if (!msg) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)';
        const fromRaw = headers.find(h => h.name === 'From')?.value ?? '';
        const from = fromRaw.replace(/<[^>]*>/, '').trim() || fromRaw;
        const unread = (msg.labelIds ?? []).includes('UNREAD');

        results.push({
          id: t.id,
          subject,
          from,
          snippet: threadData.snippet ?? '',
          unread,
        });
      } catch {
        // skip individual thread failures
      }
    }

    return results;
  } catch {
    return [];
  }
}
