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

                const { text: draft } = await generateText({
                  model: groq('llama-3.3-70b-versatile'),
                  prompt: `You are MODUS Pilot, ${name}'s chief of staff. Draft a reply ${name} can send to this email. Write in ${name}'s voice: direct, warm, concise. No subject line, no "Dear", no signature block, no placeholders like [Name] — just the reply body ready to send. 2-5 sentences. No em dashes.\n\n${personalContext ? `About ${name}: ${personalContext}\n` : ''}${goals.length ? `${name}'s current goals: ${goals.join(', ')}\n` : ''}\n--- Email from ${thread.from} ---\nSubject: ${thread.subject}\n\n${(thread.body ?? '').slice(0, 4000)}\n--- end ---\n\nReply body:`,
                  maxTokens: 400,
                });

                const reply = draft.trim();
                if (!reply) continue;

                const replySubject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
                const approvalCard = JSON.stringify({
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

                const messageText = `**${thread.from}** emailed you${thread.subject ? ` about "${thread.subject}"` : ''} and is waiting on a reply. Here's a draft you can edit and send:\n\n\`\`\`approval\n${approvalCard}\n\`\`\``;

                await Promise.all([
                  adminDb.collection('users').doc(uid).collection('conversations').add({
                    title: `Reply: ${thread.subject || thread.from}`,
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
                    triagedAt: FieldValue.serverTimestamp(),
                  }),
                  sendPushToUser(uid, `Reply to ${thread.from}?`, reply.slice(0, 120)).catch(() => {}),
                ]);

                sent++;
                console.log(`[inbox-triage] drafted reply for ${uid}: "${thread.subject}" from ${thread.from}`);
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
