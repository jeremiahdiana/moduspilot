import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
});

function localHour(timezone: string): number {
  try {
    return parseInt(
      new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }),
      10,
    );
  } catch {
    return new Date().getUTCHours();
  }
}

function localDateStr(timezone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Fires every hour — sends mid-day check-in to users whose local time is noon
export const dailyCheckin = inngest.createFunction(
  { id: 'daily-checkin' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('send-midday-checkins', async () => {
      const usersSnap = await adminDb.collection('users').get();

      const sends: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';
        const today = localDateStr(tz);

        // Only fire at local noon
        if (localHour(tz) !== 12) continue;

        // Don't send twice in the same day
        if (data.lastCheckinDate === today) continue;

        sends.push(
          (async () => {
            try {
              // Fetch goals + open tasks
              const [goalsSnap, tasksSnap] = await Promise.all([
                adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
                adminDb.collection('users').doc(uid).collection('tasks').where('done', '==', false).get(),
              ]);

              const goals = goalsSnap.docs
                .filter(d => !d.data().deleted)
                .map(d => d.data().title as string)
                .slice(0, 3);

              const tasks = tasksSnap.docs
                .filter(d => !d.data().deleted && d.data().dueDate === today)
                .map(d => d.data().title as string)
                .slice(0, 3);

              const name = data.displayName?.split(' ')[0] || 'there';

              const contextLines: string[] = [];
              if (goals.length) contextLines.push(`Active goals: ${goals.join(', ')}`);
              if (tasks.length) contextLines.push(`Due today: ${tasks.join(', ')}`);

              const { text } = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                prompt: `You are MODUS Pilot, a sharp personal chief of staff. Write a brief midday check-in for ${name}. Keep it to 2-3 sentences. Be direct and energizing — not cheerleader-y. Acknowledge what's on their plate and push them to close out the day strong.\n\n${contextLines.join('\n') || 'No specific tasks due today.'}\n\nAddress ${name} directly in the second person ("you", "your") — never "we" or "our". Do not use em dashes. No filler phrases.`,
                maxTokens: 150,
              });

              const title = `Midday Check-In — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

              await Promise.all([
                adminDb.collection('users').doc(uid).collection('conversations').add({
                  title,
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                  deleted: false,
                  briefing: true,
                  checkin: true,
                  read: false,
                  messages: [{ id: msgId(), role: 'assistant', content: text }],
                }),
                adminDb.collection('users').doc(uid).update({ lastCheckinDate: today }),
                sendPushToUser(uid, 'Midday check-in', text.slice(0, 120), { type: 'checkin' }).catch(() => {}),
              ]);

              console.log(`[daily-checkin] sent to ${uid}`);
            } catch (e) {
              console.error(`[daily-checkin] failed for ${uid}:`, e);
            }
          })(),
        );
      }

      await Promise.allSettled(sends);
      return { sent: sends.length };
    });
  },
);
