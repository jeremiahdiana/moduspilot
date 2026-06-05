import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getActionableThreads } from '@/lib/google-gmail';

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' });

// Most cards a single user gets per hourly run, so the inbox never floods them.
const MAX_PER_RUN = 3;

// Senders we never auto-draft replies to (newsletters, automated systems, etc.).
const AUTOMATED_SENDER = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?@|mailer-daemon|postmaster@|newsletter|@.*\b(mailchimp|sendgrid|sparkpost|amazonses|substack)\b)/i;

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function localHour(timezone: string): number {
  try { return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10); }
  catch { return new Date().getUTCHours(); }
}

// Current date/time in the user's timezone, so the model can resolve relative
// dates ("tomorrow", "next Tuesday") into concrete ISO datetimes for calendar holds.
function nowContext(timezone: string): { label: string; iso: string; time: string } {
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

function triagedCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('triaged_threads');
}

export const inboxTriage = inngest.createFunction(
  { id: 'inbox-triage' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('triage-inbox', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const runs: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();

        // Kill switch — default on; users can disable in Settings → Capabilities.
        if (data.settings?.capabilities?.inboxTriage === false) continue;

        // Only during waking hours (local) so we never draft at 3am.
        const tz = (data.settings?.briefingTimezone as string) ?? 'UTC';
        const hour = localHour(tz);
        if (hour < 8 || hour > 20) continue;

        runs.push((async () => {
          try {
            const accounts = await getAllValidAccessTokens(uid);
            if (!accounts.length) return;

            const ownEmails = new Set(accounts.map(a => a.email.toLowerCase()));
            const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';
            const personalContext = (data.settings?.personalContext as string | undefined)?.slice(0, 1500) ?? '';

            const goals = await adminDb.collection('users').doc(uid).collection('goals')
              .where('status', '==', 'active').get()
              .then(snap => snap.docs.filter(d => !d.data().deleted).map(d => d.data().title as string).slice(0, 3));

            let sent = 0;

            for (const { email, token } of accounts) {
              if (sent >= MAX_PER_RUN) break;

              const threads = await getActionableThreads(token, { filter: 'primary' });

              for (const thread of threads) {
                if (sent >= MAX_PER_RUN) break;

                // Only threads waiting on US: latest message is unread + inbound.
                if (!thread.unread) continue;
                if (ownEmails.has(thread.fromAddress.toLowerCase())) continue;
                // Skip newsletters / promos / transactional mail — never worth an
                // auto-drafted reply (List-Unsubscribe header or bulk category).
                if (thread.bulk) continue;
                if (AUTOMATED_SENDER.test(thread.fromAddress) || AUTOMATED_SENDER.test(thread.from)) continue;
                if ((thread.body ?? '').trim().length < 20) continue;

                // Dedup — one triage per thread, ever.
                const dedupRef = triagedCol(uid).doc(thread.id);
                if ((await dedupRef.get()).exists) continue;

                // One model call decides the cross-tool action: a concrete
                // meeting request becomes a calendar hold (schedule_event), and
                // everything else becomes a reply draft (send_email).
                const now = nowContext(tz);
                const { text: rawJson } = await generateText({
                  model: groq('llama-3.3-70b-versatile'),
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
                  maxTokens: 400,
                });

                let parsed: { kind?: string; title?: string; startDateTime?: string; endDateTime?: string; humanTime?: string; body?: string } | null = null;
                try {
                  parsed = JSON.parse(rawJson.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim());
                } catch { parsed = null; }
                if (!parsed) continue;

                let approvalCard: string;
                let messageText: string;
                let pushTitle: string;
                let pushBody: string;
                let kind: 'meeting' | 'reply';
                let convoTitle: string;

                if (parsed.kind === 'meeting' && parsed.title && parsed.startDateTime && parsed.endDateTime) {
                  // Reject unparseable datetimes rather than creating a junk hold.
                  if (isNaN(new Date(parsed.startDateTime).getTime())) continue;
                  const human = parsed.humanTime || parsed.startDateTime;
                  kind = 'meeting';
                  convoTitle = `Meeting: ${thread.subject || thread.from}`;
                  approvalCard = JSON.stringify({
                    type: 'schedule_event',
                    title: parsed.title,
                    description: `${human} · from ${thread.from}`,
                    payload: {
                      startDateTime: parsed.startDateTime,
                      endDateTime: parsed.endDateTime,
                      date: human,
                      sourceThreadId: thread.id,
                      sourceFrom: thread.fromAddress,
                    },
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
                    payload: {
                      to: thread.fromAddress,
                      subject: replySubject,
                      body: reply,
                      threadId: thread.id,
                      from_account: email,
                    },
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
                  dedupRef.set({
                    threadId: thread.id,
                    subject: thread.subject,
                    from: thread.from,
                    account: email,
                    kind,
                    triagedAt: FieldValue.serverTimestamp(),
                  }),
                  sendPushToUser(uid, pushTitle, pushBody).catch(() => {}),
                ]);

                sent++;
                console.log(`[inbox-triage] ${kind} card for ${uid}: "${thread.subject}" from ${thread.from}`);
              }
            }
          } catch (e) {
            console.error(`[inbox-triage] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(runs);
      return { processed: runs.length };
    });
  },
);
