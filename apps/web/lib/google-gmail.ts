export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  fromAddress: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#[0-9]+;/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[​‌‍﻿­‎‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPlainText(text: string): string {
  return text
    // Strip Gmail inline image placeholders like [image: Google Logo]
    .replace(/\[image:[^\]]*\]/gi, '')
    // Strip bare URLs (they're just noise in a reading context)
    .replace(/https?:\/\/\S+/g, '')
    // Strip separator lines like ----------------------------------------
    .replace(/^[-=*]{4,}\s*$/gm, '')
    // Collapse blank lines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextBody(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    const text = cleanPlainText(Buffer.from(payload.body.data, 'base64').toString('utf-8').trim());
    if (text.length > 10) return text;
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        const text = cleanPlainText(Buffer.from(part.body.data, 'base64').toString('utf-8').trim());
        if (text.length > 10) return text;
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return htmlToText(html);
      }
      if (part.mimeType?.startsWith('multipart/')) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function cleanFrom(raw: string): string {
  // "Display Name" <email@domain.com> → Display Name
  return raw.replace(/<[^>]*>/g, '').replace(/^["']|["']$/g, '').trim() || raw.trim();
}

export interface RecentSender {
  name: string;
  email: string;
  lastEmailDate: string; // YYYY-MM-DD
  threadCount: number;
}

export async function getRecentSenders(accessToken: string, days = 30): Promise<RecentSender[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;
    const query = `in:inbox after:${dateStr} -from:me -from:noreply -from:no-reply -from:donotreply`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return [];

    const listData = await listRes.json() as { threads?: { id: string }[] };
    const threads = listData.threads ?? [];
    const senderMap = new Map<string, RecentSender>();

    for (const t of threads.slice(0, 50)) {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) continue;

        const thread = await res.json() as { messages?: { payload?: { headers?: { name: string; value: string }[] } }[] };
        const msgs = thread.messages ?? [];
        if (!msgs.length) continue;

        const headers = msgs[0].payload?.headers ?? [];
        const fromRaw = headers.find(h => h.name === 'From')?.value ?? '';
        const dateHeader = headers.find(h => h.name === 'Date')?.value ?? '';

        const emailMatch = fromRaw.match(/<([^>]+)>/);
        const emailRaw = emailMatch?.[1] ?? fromRaw.trim();
        if (!emailRaw || !emailRaw.includes('@')) continue;
        const email = emailRaw.toLowerCase();
        if (email.includes('noreply') || email.includes('no-reply') || email.includes('donotreply') || email.includes('mailer-daemon')) continue;

        const name = fromRaw.replace(/<[^>]*>/g, '').replace(/^["']|["']$/g, '').trim() || email;
        const lastEmailDate = dateHeader ? (() => { try { return new Date(dateHeader).toISOString().slice(0, 10); } catch { return ''; } })() : '';

        const existing = senderMap.get(email);
        if (!existing) {
          senderMap.set(email, { name, email, lastEmailDate, threadCount: 1 });
        } else {
          existing.threadCount++;
          if (lastEmailDate && lastEmailDate > existing.lastEmailDate) {
            existing.lastEmailDate = lastEmailDate;
            existing.name = name;
          }
        }
      } catch { /* skip */ }
    }

    return Array.from(senderMap.values());
  } catch {
    return [];
  }
}

export async function getActionableThreads(
  accessToken: string,
  options?: { filter?: 'primary' | 'all' },
): Promise<GmailThread[]> {
  try {
    const filter = options?.filter ?? 'all';
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const dateStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;
    const query = filter === 'primary'
      ? `in:inbox category:primary is:unread after:${dateStr}`
      : `in:inbox is:unread after:${dateStr}`;

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
        const from = cleanFrom(fromRaw);
        const fromAddress = fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw.trim();
        const date = latestHeaders.find(h => h.name === 'Date')?.value ?? '';
        const unread = (latestMsg.labelIds ?? []).includes('UNREAD');
        const body = extractTextBody(latestMsg.payload);

        results.push({
          id: t.id,
          subject,
          from,
          fromAddress,
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
