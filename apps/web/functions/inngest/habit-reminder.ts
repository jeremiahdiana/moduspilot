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

const REMINDER_HOUR = 19; // 7pm local time

// Fires every hour — sends habit reminders to users at 7pm local time if they have incomplete habits
export const habitReminder = inngest.createFunction(
  { id: 'habit-reminder' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('send-habit-reminders', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const sends: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';
        const today = localDateStr(tz);

        if (localHour(tz) !== REMINDER_HOUR) continue;
        if (data.lastHabitReminderDate === today) continue;

        sends.push(
          (async () => {
            try {
              const habitsSnap = await adminDb
                .collection('users').doc(uid)
                .collection('habits').get();

              const incomplete = habitsSnap.docs
                .map(d => ({ title: d.data().title as string, completedDates: (d.data().completedDates ?? []) as string[] }))
                .filter(h => !h.completedDates.includes(today))
                .map(h => h.title)
                .slice(0, 5);

              if (incomplete.length === 0) return;

              const name = data.displayName?.split(' ')[0] || 'there';

              const { text } = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                prompt: `You are MODUS Pilot, a sharp personal chief of staff. Write a brief evening habit reminder for ${name}. They still haven't logged: ${incomplete.join(', ')}. Keep it to 1-2 sentences. Be direct and motivating — not preachy. End of day push, make it feel urgent but achievable. Address ${name} directly in the second person ("you", "your") — never "we" or "our". No em dashes. No filler.`,
                maxTokens: 100,
              });

              await Promise.all([
                adminDb.collection('users').doc(uid).collection('conversations').add({
                  title: 'Habit Reminder',
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                  deleted: false,
                  system: true,
                  read: false,
                  messages: [{ id: msgId(), role: 'assistant', content: text }],
                }),
                adminDb.collection('users').doc(uid).update({ lastHabitReminderDate: today }),
                sendPushToUser(uid, 'Habit check', text.slice(0, 120)).catch(() => {}),
              ]);

              console.log(`[habit-reminder] sent to ${uid} — ${incomplete.length} habits incomplete`);
            } catch (e) {
              console.error(`[habit-reminder] failed for ${uid}:`, e);
            }
          })(),
        );
      }

      await Promise.allSettled(sends);
      return { processed: sends.length };
    });
  },
);
