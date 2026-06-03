import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';
import { getAllValidAccessTokens } from '@/lib/google-oauth';
import { getUpcomingEvents, getRecentlyEndedEvents } from '@/lib/google-calendar';

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' });

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function briefsCol(uid: string) {
  return adminDb.collection('users').doc(uid).collection('meeting_briefs');
}

export const meetingIntelligence = inngest.createFunction(
  { id: 'meeting-intelligence' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('process-meetings', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const sends: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();

        sends.push((async () => {
          try {
            const accounts = await getAllValidAccessTokens(uid);
            if (accounts.length === 0) return;

            const goals = await adminDb.collection('users').doc(uid).collection('goals')
              .where('status', '==', 'active').get()
              .then(snap => snap.docs.filter(d => !d.data().deleted).map(d => d.data().title as string).slice(0, 3));

            const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';

            for (const { email, token } of accounts) {
              const [upcoming, recentlyEnded] = await Promise.all([
                getUpcomingEvents(token, 60),
                getRecentlyEndedEvents(token, 60),
              ]);

              // Pre-meeting briefs
              for (const event of upcoming.filter(e => !e.allDay)) {
                const briefId = `pre_${event.id}`;
                const existingDoc = await briefsCol(uid).doc(briefId).get();
                if (existingDoc.exists) continue;

                const startMins = (new Date(event.start).getTime() - Date.now()) / 60000;
                if (startMins < 5 || startMins > 60) continue;

                const startTime = new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                const { text } = await generateText({
                  model: groq('llama-3.3-70b-versatile'),
                  prompt: `You are MODUS Pilot. Write a sharp pre-meeting brief for ${name} going into "${event.title}" at ${startTime}. 3 sentences max: (1) one sentence on what this meeting is likely about, (2) one thing to have sharp in mind going in, (3) one question they should be ready to answer or ask. Address ${name} directly in the second person ("you", "your") — never "we" or "our". Direct, no filler, no em dashes.\n\nActive goals for context: ${goals.join(', ') || 'none'}\n${event.location ? `Location: ${event.location}` : ''}`,
                  maxTokens: 150,
                });

                await Promise.all([
                  adminDb.collection('users').doc(uid).collection('conversations').add({
                    title: `Pre-meeting: ${event.title}`,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    deleted: false,
                    system: true,
                    meetingBrief: true,
                    read: false,
                    messages: [{ id: msgId(), role: 'assistant', content: text }],
                  }),
                  briefsCol(uid).doc(briefId).set({ eventId: event.id, eventTitle: event.title, account: email, sentAt: FieldValue.serverTimestamp() }),
                  sendPushToUser(uid, `${event.title} in ${Math.round(startMins)} min`, text.slice(0, 120)).catch(() => {}),
                ]);

                console.log(`[meeting-intelligence] pre-brief sent for ${event.title} to ${uid}`);
              }

              // Post-meeting prompts
              for (const event of recentlyEnded.filter(e => !e.allDay)) {
                const briefId = `post_${event.id}`;
                const existingDoc = await briefsCol(uid).doc(briefId).get();
                if (existingDoc.exists) continue;

                const endMins = (Date.now() - new Date(event.end).getTime()) / 60000;
                if (endMins < 5 || endMins > 60) continue;

                const prompt = `How did "${event.title}" go? Any action items or decisions to capture? I'll turn them into tasks if you want.`;

                await Promise.all([
                  adminDb.collection('users').doc(uid).collection('conversations').add({
                    title: `Post-meeting: ${event.title}`,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    deleted: false,
                    system: true,
                    meetingBrief: true,
                    postMeeting: true,
                    read: false,
                    messages: [{ id: msgId(), role: 'assistant', content: prompt }],
                  }),
                  briefsCol(uid).doc(briefId).set({ eventId: event.id, eventTitle: event.title, account: email, sentAt: FieldValue.serverTimestamp() }),
                  sendPushToUser(uid, `How did ${event.title} go?`, prompt.slice(0, 120)).catch(() => {}),
                ]);

                console.log(`[meeting-intelligence] post-meeting sent for ${event.title} to ${uid}`);
              }
            }
          } catch (e) {
            console.error(`[meeting-intelligence] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(sends);
      return { processed: sends.length };
    });
  },
);
