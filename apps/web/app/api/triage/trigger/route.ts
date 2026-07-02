import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateProactiveText } from '@/lib/proactive-model';
import { sendPushToUser } from '@/lib/fcm-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';
const MAX_PER_RUN = 3;
const AUTOMATED_SENDER = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?@|mailer-daemon|postmaster@|newsletter|@.*\b(mailchimp|sendgrid|sparkpost|amazonses|substack)\b)/i;

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function nowContext(timezone: string) {
  const now = new Date();
  try {
    return {
      label: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone }),
      iso: now.toLocaleDateString('en-CA', { timeZone: timezone }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }),
    };
  } catch {
    return { label: now.toUTCString(), iso: now.toISOString().slice(0, 10), time: `${now.getUTCHours()}:00` };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const debug = new URL(req.url).searchParams.get('debug') === '1';

  const [userDoc, goalsSnap] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    adminDb.collection('users').doc(uid).collection('goals')
      .where('status', '==', 'active').get(),
  ]);

  const body = await req.json().catch(() => ({}));
  const accountFilter: string | null = body.account ?? null;

  const data = userDoc.data() ?? {};
  const allAccounts = await getAllValidAccessTokens(uid);
  if (!allAccounts.length) {
    return NextResponse.json({ created: 0, message: 'No Google account connected' });
  }

  const accounts = accountFilter
    ? allAccounts.filter(a => a.email.toLowerCase() === accountFilter.toLowerCase())
    : allAccounts;

  if (!accounts.length) {
    return NextResponse.json({ created: 0, message: `Account ${accountFilter} not found or not connected` });
  }

  const ownEmails = new Set(allAccounts.map(a => a.email.toLowerCase()));
  const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';
  const personalContext = (data.settings?.personalContext as string | undefined)?.slice(0, 1500) ?? '';
  const tz = (data.settings?.briefingTimezone as string | undefined) ?? 'UTC';
  const goals = goalsSnap.docs.filter(d => !d.data().deleted).map(d => d.data().title as string).slice(0, 3);
  const triagedCol = adminDb.collection('users').doc(uid).collection('triaged_threads');
  let created = 0;
  const debugLog: { account: string; threads: { id: string; subject: string; from: string; skipped?: string }[] }[] = [];

  for (const { email, token } of accounts) {
    if (created >= MAX_PER_RUN) break;
    const threads = await getActionableThreads(token, { filter: 'primary' });
    const debugThreads: { id: string; subject: string; from: string; skipped?: string }[] = [];
    if (debug) debugLog.push({ account: email, threads: debugThreads });

    for (const thread of threads) {
      if (created >= MAX_PER_RUN) break;
      const skip = (reason: string) => { if (debug) debugThreads.push({ id: thread.id, subject: thread.subject, from: thread.fromAddress, skipped: reason }); };
      if (!thread.unread) { skip('not unread'); continue; }
      if (ownEmails.has(thread.fromAddress.toLowerCase())) { skip('own account'); continue; }
      if (thread.bulk) { skip('bulk/newsletter'); continue; }
      if (AUTOMATED_SENDER.test(thread.fromAddress) || AUTOMATED_SENDER.test(thread.from)) { skip('automated sender'); continue; }
      if ((thread.body ?? '').trim().length < 20) { skip(`body too short (${(thread.body ?? '').trim().length} chars)`); continue; }

      const dedupRef = triagedCol.doc(thread.id);
      if ((await dedupRef.get()).exists) { skip('already triaged'); continue; }

      const now = nowContext(tz);
      let rawJson = '';
      try {
        rawJson = await generateProactiveText({
          plan: data.plan,
          maxTokens: 400,
          prompt: `You are MODUS Pilot, ${name}'s chief of staff, triaging an inbound email. Today is ${now.label} (${now.iso}); the current local time is ${now.time}.

Decide what ${name} needs and output ONLY a JSON object (no markdown fences, no prose). Exactly one of:
{"kind":"meeting","title":"short event title e.g. Call with Jane (Acme)","startDateTime":"YYYY-MM-DDTHH:MM:SS","endDateTime":"YYYY-MM-DDTHH:MM:SS","humanTime":"e.g. Tuesday, June 10 at 2:00 PM"}
{"kind":"reply","body":"the reply body"}

Use kind=meeting ONLY when the email proposes or requests a meeting/call at an UNAMBIGUOUS date AND time you can pin to a concrete slot:
- Resolve relative dates ("tomorrow","next Tuesday") against today's date above. Use the proposed local time exactly. Do NOT include a timezone or Z suffix in the datetimes.
- If only a start time is given, set endDateTime to 30 minutes later.
- If the time is vague or missing ("sometime next week","are you free?"), use kind=reply instead.

For kind=reply, write the body in ${name}'s voice: direct, warm, concise. No subject line, no "Dear", no signature, no placeholders like [Name]. 2-5 sentences. No em dashes.
${personalContext ? `\nAbout ${name}: ${personalContext}` : ''}${goals.length ? `\n${name}'s current goals: ${goals.join(', ')}` : ''}

--- Email from ${thread.from} ---
Subject: ${thread.subject}

${(thread.body ?? '').slice(0, 4000)}
--- end ---`,
        });
      } catch { continue; }

      let parsed: { kind?: string; title?: string; startDateTime?: string; endDateTime?: string; humanTime?: string; body?: string } | null = null;
      try {
        parsed = JSON.parse(rawJson.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim());
      } catch { continue; }
      if (!parsed) continue;

      let approvalCard: string;
      let messageText: string;
      let pushTitle: string;
      let pushBody: string;
      let kind: 'meeting' | 'reply';
      let convoTitle: string;

      if (parsed.kind === 'meeting' && parsed.title && parsed.startDateTime && parsed.endDateTime) {
        if (isNaN(new Date(parsed.startDateTime).getTime())) continue;
        const human = parsed.humanTime || parsed.startDateTime;
        kind = 'meeting';
        convoTitle = `Meeting: ${thread.subject || thread.from}`;
        approvalCard = JSON.stringify({
          type: 'schedule_event',
          title: parsed.title,
          description: `${human} · from ${thread.from}`,
          payload: { startDateTime: parsed.startDateTime, endDateTime: parsed.endDateTime, date: human, sourceThreadId: thread.id, sourceFrom: thread.fromAddress },
        });
        messageText = `**${thread.from}** proposed a meeting${thread.subject ? ` about "${thread.subject}"` : ''}: ${human}. Here's a calendar hold you can approve, edit, or skip:\n\n\`\`\`approval\n${approvalCard}\n\`\`\``;
        pushTitle = `Meeting with ${thread.from}?`;
        pushBody = human;
      } else {
        const reply = (parsed.body ?? '').trim();
        if (!reply) continue;
        kind = 'reply';
        convoTitle = `Reply: ${thread.subject || thread.from}`;
        const replySubject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
        approvalCard = JSON.stringify({
          type: 'send_email',
          title: `Reply to ${thread.from}`,
          description: `Re: ${thread.subject}`,
          payload: { to: thread.fromAddress, subject: replySubject, body: reply, threadId: thread.id, from_account: email },
        });
        messageText = `**${thread.from}** emailed you${thread.subject ? ` about "${thread.subject}"` : ''} and is waiting on a reply. Here's a draft you can edit and send:\n\n\`\`\`approval\n${approvalCard}\n\`\`\``;
        pushTitle = `Reply to ${thread.from}?`;
        pushBody = reply.slice(0, 120);
      }

      await Promise.all([
        adminDb.collection('users').doc(uid).collection('conversations').add({
          title: convoTitle,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deleted: false,
          system: true,
          inboxTriage: true,
          read: false,
          messages: [{ id: msgId(), role: 'assistant', content: messageText }],
        }),
        dedupRef.set({ threadId: thread.id, subject: thread.subject, from: thread.from, account: email, kind, triagedAt: FieldValue.serverTimestamp() }),
        sendPushToUser(uid, pushTitle, pushBody).catch(() => {}),
      ]);

      created++;
    }
  }

  if (debug) return NextResponse.json({ created, debug: debugLog });
  return NextResponse.json({ created, message: created > 0 ? `${created} draft${created > 1 ? 's' : ''} created` : 'No new emails to triage' });
}
