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

    // Fetch all thread metadata in parallel
    const settled = await Promise.allSettled(
      threads.slice(0, 50).map(t =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.ok ? r.json() as Promise<{ messages?: { payload?: { headers?: { name: string; value: string }[] } }[] }> : null)
      )
    );

    for (const s of settled) {
      if (s.status !== 'fulfilled' || !s.value) continue;
      try {
        const msgs = s.value.messages ?? [];
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
          if (lastEmailDate && lastEmailDate > existing.lastEmailDate) { existing.lastEmailDate = lastEmailDate; existing.name = name; }
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
    const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days
    const dateStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`;

    const buildQuery = (useCategory: boolean) =>
      useCategory
        ? `in:inbox category:primary after:${dateStr}`
        : `in:inbox after:${dateStr}`;

    const fetchThreadIds = async (q: string) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.threads ?? []) as { id: string }[];
    };

    let threads = filter === 'primary'
      ? await fetchThreadIds(buildQuery(true))
      : await fetchThreadIds(buildQuery(false));

    // Fallback for .edu / Workspace accounts that don't have Gmail categories
    if (threads.length === 0 && filter === 'primary') {
      threads = await fetchThreadIds(buildQuery(false));
    }

    if (threads.length === 0) return [];

    // Fetch all thread details in parallel (not sequentially)
    const settled = await Promise.allSettled(
      threads.slice(0, 5).map(t =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.ok ? r.json() : null)
      )
    );

    const results: GmailThread[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled' || !s.value) continue;
      try {
        const threadData = s.value;
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

        results.push({ id: threadData.id ?? '', subject, from, fromAddress, snippet: threadData.snippet ?? '', body, date, unread });
      } catch { /* skip */ }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * The address to reply to for a thread — the most recent message's From that
 * isn't one of the user's own accounts. Used as a server-side safety net so a
 * reply can never go to an AI-fabricated address (e.g. name@example.com): when
 * a send carries a threadId, we resolve the real recipient from Gmail itself.
 * Returns null if it can't be determined (caller falls back to the payload).
 */
export async function getThreadReplyAddress(
  accessToken: string,
  threadId: string,
  selfEmails: string[] = [],
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const msgs = (data.messages ?? []) as { payload?: { headers?: { name: string; value: string }[] } }[];
    const self = selfEmails.map(e => e.toLowerCase());
    const addrOf = (m: typeof msgs[number]) => {
      const raw = m.payload?.headers?.find(h => h.name === 'From')?.value ?? '';
      return (raw.match(/<([^>]+)>/)?.[1] ?? raw.trim()).toLowerCase();
    };
    // Most recent inbound sender (skip the user's own messages).
    for (let i = msgs.length - 1; i >= 0; i--) {
      const addr = addrOf(msgs[i]);
      if (addr && !self.includes(addr)) return addr;
    }
    // Fallback: newest From, even if it's the user.
    return msgs.length ? (addrOf(msgs[msgs.length - 1]) || null) : null;
  } catch {
    return null;
  }
}

export interface LastThread {
  threadId: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
}

/**
 * Most recent thread involving a specific contact (either direction), used to
 * give a reach-out draft real context. Returns null if nothing is found.
 */
export async function getLastThreadWith(accessToken: string, email: string): Promise<LastThread | null> {
  try {
    const q = `from:${email} OR to:${email}`;
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return null;
    const listData = await listRes.json() as { threads?: { id: string }[] };
    const first = listData.threads?.[0];
    if (!first) return null;

    const tRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${first.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!tRes.ok) return null;
    const threadData = await tRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgs: any[] = threadData.messages ?? [];
    if (!msgs.length) return null;

    const firstMsg = msgs[0];
    const latestMsg = msgs[msgs.length - 1];
    const firstHeaders: { name: string; value: string }[] = firstMsg.payload?.headers ?? [];
    const subject = firstHeaders.find(h => h.name === 'Subject')?.value ?? '(no subject)';
    const latestHeaders: { name: string; value: string }[] = latestMsg.payload?.headers ?? [];
    const date = latestHeaders.find(h => h.name === 'Date')?.value ?? '';
    const body = extractTextBody(latestMsg.payload);

    return { threadId: threadData.id ?? first.id, subject, snippet: threadData.snippet ?? '', body, date };
  } catch {
    return null;
  }
}
