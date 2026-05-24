import { inngest } from '@/lib/inngest';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { sendPushToUser } from '@/lib/fcm-admin';

const groq = createOpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1' });

function localHour(timezone: string): number {
  try {
    return parseInt(new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }), 10);
  } catch { return new Date().getUTCHours(); }
}

function localDayOfWeek(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).formatToParts(new Date());
    const day = parts.find(p => p.type === 'weekday')?.value ?? '';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(day);
  } catch { return new Date().getDay(); }
}

function isoWeek(timezone: string): string {
  const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: timezone }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function localDateStr(timezone: string): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function msgId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const REVIEW_HOUR = 20; // 8pm local Sunday

export const weeklyReview = inngest.createFunction(
  { id: 'weekly-review' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('send-weekly-reviews', async () => {
      const usersSnap = await adminDb.collection('users').get();
      const sends: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const data = userDoc.data();
        const tz = data.settings?.briefingTimezone ?? 'UTC';

        if (localDayOfWeek(tz) !== 0) continue; // Sunday only
        if (localHour(tz) !== REVIEW_HOUR) continue;

        const thisWeek = isoWeek(tz);
        if (data.lastWeeklyReviewDate === thisWeek) continue;

        sends.push((async () => {
          try {
            const today = localDateStr(tz);
            const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

            const [tasksSnap, habitsSnap, goalsSnap] = await Promise.all([
              adminDb.collection('users').doc(uid).collection('tasks').get(),
              adminDb.collection('users').doc(uid).collection('habits').get(),
              adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
            ]);

            const completedThisWeek = tasksSnap.docs
              .filter(d => d.data().done && !d.data().deleted)
              .map(d => d.data().title as string).slice(0, 8);

            const slippedThisWeek = tasksSnap.docs
              .filter(d => !d.data().done && !d.data().deleted && (d.data().dueDate ?? '') !== '' && (d.data().dueDate as string) >= sevenDaysAgo && (d.data().dueDate as string) <= today)
              .map(d => d.data().title as string).slice(0, 5);

            const habitSummary = habitsSnap.docs.map(d => {
              const completedDates = (d.data().completedDates ?? []) as string[];
              const thisWeekDates = completedDates.filter(date => date >= sevenDaysAgo && date <= today);
              return { title: d.data().title as string, streak: d.data().streak ?? 0, completedThisWeek: thisWeekDates.length };
            });

            const goals = goalsSnap.docs.filter(d => !d.data().deleted).map(d => ({
              title: d.data().title as string,
              progress: d.data().progress ?? 0,
            })).slice(0, 5);

            const name = (data.displayName as string | undefined)?.split(' ')[0] || 'there';

            // 30-day pattern analysis — separate call with faster model
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const allTasksSnap = await adminDb.collection('users').doc(uid).collection('tasks').get();
            const slipped30 = allTasksSnap.docs
              .filter(d => !d.data().done && !d.data().deleted)
              .map(d => d.data().title as string)
              .slice(0, 20);
            const habit30Lines = habitsSnap.docs.map(d => {
              const completedDates = (d.data().completedDates ?? []) as string[];
              const count = completedDates.filter(dt => dt >= thirtyDaysAgo).length;
              return `${d.data().title as string}: ${count}/30`;
            });

            let patternText = '';
            if (slipped30.length || habit30Lines.length) {
              try {
                const { text: p } = await generateText({
                  model: groq('llama-3.1-8b-instant'),
                  prompt: `Analyze this person's 30-day behavioral data and identify ONE specific pattern. Be brutally specific — name the category, give exact counts. 1-2 sentences max. No filler, no em dashes.\n\nPending tasks (never completed): ${slipped30.join(', ') || 'none'}\nHabit rates (last 30 days): ${habit30Lines.join(', ') || 'none'}`,
                  maxTokens: 80,
                });
                patternText = p.trim();
              } catch { /* non-fatal */ }
            }

            const contextLines: string[] = [];
            if (completedThisWeek.length) contextLines.push(`Tasks completed this week: ${completedThisWeek.join(', ')}`);
            if (slippedThisWeek.length) contextLines.push(`Tasks that slipped: ${slippedThisWeek.join(', ')}`);
            if (habitSummary.length) contextLines.push(`Habit consistency: ${habitSummary.map(h => `${h.title} (${h.completedThisWeek}/7 days, streak: ${h.streak})`).join(', ')}`);
            if (goals.length) contextLines.push(`Active goals: ${goals.map(g => `${g.title} at ${g.progress}%`).join(', ')}`);
            if (patternText) contextLines.push(`Behavioral pattern (30-day analysis): ${patternText}`);

            const { text } = await generateText({
              model: groq('llama-3.3-70b-versatile'),
              prompt: `You are MODUS Pilot, a sharp personal chief of staff. Write a weekly review for ${name}. Structure it as: (1) what they shipped this week, (2) what slipped and why it might have, (3) the behavioral pattern identified below — state it as fact, not speculation, (4) the sharpest focus for next week. Keep it under 200 words. Sharp, direct, no filler, no em dashes. Make it feel like a trusted advisor debriefing them, not a report.\n\n${contextLines.join('\n') || 'No data for this week.'}`,
              maxTokens: 350,
            });

            const title = `Weekly Review — Week of ${sevenDaysAgo}`;

            await Promise.all([
              adminDb.collection('users').doc(uid).collection('conversations').add({
                title,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                deleted: false,
                briefing: true,
                weeklyReview: true,
                read: false,
                messages: [{ id: msgId(), role: 'assistant', content: text }],
              }),
              adminDb.collection('users').doc(uid).update({ lastWeeklyReviewDate: thisWeek }),
              sendPushToUser(uid, 'Weekly review ready', text.slice(0, 120)).catch(() => {}),
            ]);

            console.log(`[weekly-review] sent to ${uid}`);
          } catch (e) {
            console.error(`[weekly-review] failed for ${uid}:`, e);
          }
        })());
      }

      await Promise.allSettled(sends);
      return { sent: sends.length };
    });
  },
);
