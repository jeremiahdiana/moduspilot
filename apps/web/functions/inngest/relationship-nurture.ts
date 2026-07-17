import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getLastThreadWith } from '@/lib/google-gmail';

const groq = createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY ?? '', baseURL: 'https://ai-gateway.vercel.sh/v1' });

const MAX_PER_RUN = 2;          // gentle — at most 2 reconnect nudges/day per user
const QUIET_MIN_DAYS = 21;      // "gone quiet" starts at 3 weeks of silence
const QUIET_MAX_DAYS = 120;     // ...but not so long it's a cold/dead contact
const MIN_THREADS = 3;          // a real relationship, not a one-off sender
const RENUDGE_COOLDOWN_DAYS = 45; // don't nag about the same person repeatedly

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function localHour(timezone: string): number {
  try { return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10); }
  catch { return new Date().getUTCHours(); }
}

function localDateStr(timezone: string): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

export const relationshipNurture = inngest.createFunction(
  { id: 'relationship-nurture' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('nurture-relationships', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const runs: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();

        if (data.settings?.capabilities?.relationshipNurture === false) continue;

        // Once a day, at 9am local.
        const tz = (data.settings?.briefingTimezone as string) ?? 'UTC';
        if (localHour(tz) !== 9) continue;
        const today = localDateStr(tz);
        if (data.lastNurtureDate === today) continue;

        runs.push((async () => {
          try {
            const accounts = await getAllValidAccessTokens(uid);
            if (!accounts.length) return;

            const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';
            const personalContext = (data.settings?.personalContext as string | undefined)?.slice(0, 1500) ?? '';
            const goals = await adminDb.collection('users').doc(uid).collection('goals')
              .where('status', '==', 'active').get()
              .then(snap => snap.docs.filter(d => !d.data().deleted).map(d => d.data().title as string).slice(0, 3));

            const now = Date.now();
            const contactsSnap = await adminDb.collection('users').doc(uid).collection('contacts').get();

            type Cand = { ref: FirebaseFirestore.DocumentReference; email: string; cname: string; threadCount: number; daysSince: number };
            const candidates: Cand[] = [];

            for (const cDoc of contactsSnap.docs) {
              const c = cDoc.data();
              const threadCount = (c.threadCount as number) ?? 0;
              const lastEmailDate = c.lastEmailDate as string | undefined;
              if (threadCount < MIN_THREADS || !lastEmailDate) continue;

              const daysSince = (now - new Date(lastEmailDate).getTime()) / 86400000;
              if (isNaN(daysSince) || daysSince < QUIET_MIN_DAYS || daysSince > QUIET_MAX_DAYS) continue;

              const lastNudged = c.lastNudgedAt instanceof Timestamp ? c.lastNudgedAt.toMillis() : 0;
              if (lastNudged && (now - lastNudged) / 86400000 < RENUDGE_COOLDOWN_DAYS) continue;

              candidates.push({
                ref: cDoc.ref,
                email: (c.email as string) ?? '',
                cname: (c.name as string) || (c.email as string) || '',
                threadCount,
                daysSince: Math.round(daysSince),
              });
            }

            // Strongest relationships first.
            candidates.sort((a, b) => b.threadCount - a.threadCount);

            let sent = 0;
            for (const cand of candidates) {
              if (sent >= MAX_PER_RUN) break;
              if (!cand.email.includes('@')) continue;

              // Look up the last thread for context — try each account.
              let last = null as Awaited<ReturnType<typeof getLastThreadWith>>;
              for (const acct of accounts) {
                last = await getLastThreadWith(acct.token, cand.email).catch(() => null);
                if (last) break;
              }

              const firstName = (cand.cname || cand.email).split(' ')[0];
              const context = last
                ? `Last time you spoke (about ${cand.daysSince} days ago) the thread subject was "${last.subject}". Most recent message excerpt:\n${(last.body || last.snippet || '').slice(0, 1200)}`
                : `It has been about ${cand.daysSince} days since you last exchanged email.`;

              const { text: draft } = await generateText({
                model: groq('meta/llama-3.3-70b'),
                prompt: `You are MODUS Pilot, ${name}'s chief of staff. Draft a short, warm reach-out ${name} can send to ${firstName}, someone they've fallen out of touch with. Write in ${name}'s voice: genuine, specific, low-pressure — not salesy. Reference the prior context naturally if there is any. No subject line, no "Dear", no signature, no placeholders. 2-4 sentences. No em dashes.\n\n${personalContext ? `About ${name}: ${personalContext}\n` : ''}${goals.length ? `${name}'s current goals: ${goals.join(', ')}\n` : ''}\nContext on ${firstName}:\n${context}\n\nReach-out body:`,
                maxTokens: 300,
              });

              const body = draft.trim();
              if (!body) continue;

              const subject = last?.subject
                ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`)
                : 'Catching up';

              const approvalCard = JSON.stringify({
                type: 'send_email',
                title: `Reach out to ${cand.cname || firstName}`,
                description: `It's been ~${cand.daysSince} days since you connected`,
                payload: {
                  to: cand.email,
                  subject,
                  body,
                  ...(last?.threadId ? { threadId: last.threadId } : {}),
                  from_account: accounts[0].email,
                },
              });

              const messageText = `You haven't been in touch with **${cand.cname || cand.email}** in about ${cand.daysSince} days. Worth reconnecting? Here's a draft you can edit and send:\n\n\`\`\`approval\n${approvalCard}\n\`\`\``;

              await Promise.all([
                adminDb.collection('users').doc(uid).collection('conversations').add({
                  title: `Reconnect: ${cand.cname || cand.email}`,
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                  deleted: false,
                  system: true,
                  relationshipNudge: true,
                  read: false,
                  messages: [{ id: msgId(), role: 'assistant', content: messageText }],
                }),
                cand.ref.set({ lastNudgedAt: FieldValue.serverTimestamp() }, { merge: true }),
                sendPushToUser(uid, `Reconnect with ${firstName}?`, body.slice(0, 120)).catch(() => {}),
              ]);

              sent++;
              console.log(`[relationship-nurture] nudged ${uid} to reconnect with ${cand.email} (${cand.daysSince}d quiet)`);
            }

            // Mark the day done so we don't reprocess on a later run.
            await adminDb.collection('users').doc(uid).update({ lastNurtureDate: today });
          } catch (e) {
            console.error(`[relationship-nurture] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(runs);
      return { processed: runs.length };
    });
  },
);
