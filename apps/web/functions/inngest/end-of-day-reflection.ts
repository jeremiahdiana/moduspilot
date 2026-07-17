import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';

const groq = createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY ?? '', baseURL: 'https://ai-gateway.vercel.sh/v1' });

function localHour(timezone: string): number {
  try {
    return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10);
  } catch { return new Date().getUTCHours(); }
}

function localDateStr(timezone: string): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const DEFAULT_REFLECTION_HOUR = 21; // 9pm local — fallback if user hasn't set it

export const endOfDayReflection = inngest.createFunction(
  { id: 'end-of-day-reflection' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('send-reflections', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const sends: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';
        const today = localDateStr(tz);

        if (localHour(tz) !== (data.settings?.reflectionHour ?? DEFAULT_REFLECTION_HOUR)) continue;
        if (data.lastReflectionDate === today) continue;

        sends.push((async () => {
          try {
            const [tasksSnap, habitsSnap, goalsSnap] = await Promise.all([
              adminDb.collection('users').doc(uid).collection('tasks').get(),
              adminDb.collection('users').doc(uid).collection('habits').get(),
              adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
            ]);

            const completed = tasksSnap.docs
              .filter(d => d.data().done && !d.data().deleted)
              .map(d => d.data().title as string).slice(0, 5);

            const overdue = tasksSnap.docs
              .filter(d => !d.data().done && !d.data().deleted && (d.data().dueDate ?? '') !== '' && (d.data().dueDate as string) <= today)
              .map(d => d.data().title as string).slice(0, 3);

            const habitsToday = habitsSnap.docs.map(d => ({
              title: d.data().title as string,
              done: ((d.data().completedDates ?? []) as string[]).includes(today),
            }));
            const habitsDone = habitsToday.filter(h => h.done).map(h => h.title);
            const habitsMissed = habitsToday.filter(h => !h.done).map(h => h.title);

            const goals = goalsSnap.docs.filter(d => !d.data().deleted).map(d => d.data().title as string).slice(0, 3);
            const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';

            const contextLines: string[] = [];
            if (completed.length) contextLines.push(`Tasks completed today: ${completed.join(', ')}`);
            if (overdue.length) contextLines.push(`Tasks that slipped: ${overdue.join(', ')}`);
            if (habitsDone.length) contextLines.push(`Habits logged: ${habitsDone.join(', ')}`);
            if (habitsMissed.length) contextLines.push(`Habits missed: ${habitsMissed.join(', ')}`);
            if (goals.length) contextLines.push(`Active goals: ${goals.join(', ')}`);

            const { text } = await generateText({
              model: groq('meta/llama-3.3-70b'),
              prompt: `You are MODUS Pilot, a sharp personal chief of staff. Write a brief end-of-day reflection for ${name}. 3-4 sentences max. Acknowledge what they got done, call out what slipped without lecturing, and set the frame for tomorrow. Address ${name} directly in the second person ("you", "your") — never "we" or "our". Direct, no filler, no em dashes.\n\n${contextLines.join('\n') || 'No task data for today.'}`,
              maxTokens: 200,
            });

            const title = `Evening Reflection — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

            await Promise.all([
              adminDb.collection('users').doc(uid).collection('conversations').add({
                title,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                deleted: false,
                briefing: true,
                reflection: true,
                read: false,
                messages: [{ id: msgId(), role: 'assistant', content: text }],
              }),
              adminDb.collection('users').doc(uid).update({ lastReflectionDate: today }),
              sendPushToUser(uid, 'Evening reflection', text.slice(0, 120)).catch(() => {}),
            ]);

            console.log(`[end-of-day-reflection] sent to ${uid}`);
          } catch (e) {
            console.error(`[end-of-day-reflection] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(sends);
      return { sent: sends.length };
    });
  },
);
