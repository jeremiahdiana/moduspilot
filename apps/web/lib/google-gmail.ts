export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextBody(payload: any): string {
  if (!payload) return '';
  // Direct text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8').trim();
  }
  // Search parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8').trim();
      }
    }
    // Fallback: try html and strip tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      // Recurse into multipart
      if (part.mimeType?.startsWith('multipart/')) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

export async function getActionableThreads(accessToken: string): Promise<GmailThread[]> {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const dateStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;
    const query = `in:inbox is:unread after:${dateStr}`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) return [];

    const listData = await listRes.json();
    const threads: { id: string }[] = listData.threads ?? [];
    const results: GmailThread[] = [];

    for (const t of threads.slice(0, 10)) {
      try {
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!threadRes.ok) continue;

        const threadData = await threadRes.json();
        // Use latest message for headers, first for subject
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msgs: any[] = threadData.messages ?? [];
        if (!msgs.length) continue;
        const firstMsg = msgs[0];
        const latestMsg = msgs[msgs.length - 1];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstHeaders: { name: string; value: string }[] = firstMsg.payload?.headers ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const latestHeaders: { name: string; value: string }[] = latestMsg.payload?.headers ?? [];

        const subject = firstHeaders.find(h => h.name === 'Subject')?.value ?? '(no subject)';
        const fromRaw = latestHeaders.find(h => h.name === 'From')?.value ?? '';
        const from = fromRaw.replace(/<[^>]*>/, '').trim() || fromRaw;
        const date = latestHeaders.find(h => h.name === 'Date')?.value ?? '';
        const unread = (latestMsg.labelIds ?? []).includes('UNREAD');
        const body = extractTextBody(latestMsg.payload);

        results.push({
          id: t.id,
          subject,
          from,
          snippet: threadData.snippet ?? '',
          body,
          date,
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
