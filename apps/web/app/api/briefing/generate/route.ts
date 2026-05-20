import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { FieldValue } from 'firebase-admin/firestore';

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
});

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let uid: string;
    let name = 'there';
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      name = decoded.name?.split(' ')[0] || 'there';
    } catch {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const [goalsSnap, tasksSnap, habitsSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
      adminDb.collection('users').doc(uid).collection('tasks').where('done', '==', false).get(),
      adminDb.collection('users').doc(uid).collection('habits').get(),
    ]);

    const goals = goalsSnap.docs
      .filter(d => !d.data().deleted)
      .map(d => ({ title: d.data().title, progress: d.data().progress ?? 0 }));

    const tasks = tasksSnap.docs
      .filter(d => !d.data().deleted)
      .map(d => ({
        title: d.data().title,
        priority: d.data().priority ?? null,
        dueDate: d.data().dueDate ?? null,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] ?? null,
      }));

    const habits = habitsSnap.docs.map(d => ({
      title: d.data().title,
      streak: d.data().streak ?? 0,
      completedDates: d.data().completedDates ?? [],
    }));

    const goalsText = goals.length
      ? goals.map(g => `- ${g.title} (${g.progress}% complete)`).join('\n')
      : 'None.';

    const tasksText = tasks.length
      ? tasks.slice(0, 12).map(t => {
          const parts = [`- ${t.title}`];
          if (t.priority) parts.push(`[${t.priority}]`);
          if (t.dueDate) parts.push(`due ${t.dueDate}`);
          if (t.createdAt && t.createdAt <= yesterday) parts.push(`(open since ${t.createdAt})`);
          return parts.join(' ');
        }).join('\n')
      : 'None.';

    const activeHabits = habits.filter(h => h.streak > 0 || h.completedDates.some((d: string) => d >= yesterday));
    const habitsText = activeHabits.length
      ? activeHabits.map(h => {
          const doneToday = h.completedDates.includes(today);
          const atRisk = !doneToday && h.streak > 0;
          return `- ${h.title} — ${h.streak} day streak${doneToday ? ' (done today)' : atRisk ? ' [AT RISK — not done yet]' : ''}`;
        }).join('\n')
      : 'No habits with recent activity.';

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are MODUS, an AI chief of staff generating ${name}'s daily briefing. Today is ${todayLabel()}.

Write a single flowing message — no headers, no numbered sections, no bullet points for the overall structure. Write the way a sharp chief of staff would brief someone before they walk into their day: tight, sequenced, nothing wasted.

Follow this exact order:

1. OPENING LINE — One sentence. Reference something real: the date, what's ahead, or a signal from their data. No "Good morning" filler. No affirmations. Drop straight into what matters.

2. ENERGY CHECK — Ask where they're at. One line, conversational. Then write: "Fully charged / Okay / Running low — or just tell me." Do not skip this.

3. TOP 3 FOR TODAY — Pull from their active goals and open tasks. Rank by urgency and goal alignment. List exactly three — no more, no less. For each: the item, where it came from (goal name or due date), and any time pressure. If priorities are unclear, make a call and show your reasoning in one line. Use a simple dash list only for these three items.

4. LOOSE END — One item only. The single most important unresolved thing from yesterday or earlier (look for tasks open since before today). State what it is and why it still matters. If nothing is genuinely overdue, skip this section entirely — do not fill space.

5. HABIT CHECK — Show only habits with active streaks or ones at risk today. Flag at-risk ones clearly. If all habits are clean or none have recent activity, skip this section. Use a simple dash list only for the habits.

6. PATTERN CALLOUT (conditional) — Only include if there is a genuine pattern worth naming: repeated deferrals on the same task, a goal with no recent progress, habits losing streaks on certain days. One line, neutral, specific. If there is no real pattern, skip entirely.

7. CLOSING — End with exactly this: "That's your morning. Anything on your mind?" followed by a new line: "Add a task, share what's weighing on you, or ask me to check something." Then stop.

Rules:
- Never fabricate data you don't have. If a category is empty, either skip it or say so in one line.
- Never use em dashes. Never say "I hope", "I trust", or anything sycophantic.
- Never use markdown headers (##, **bold section titles**, etc). Plain text and simple dashes only.
- The tone is direct, trusted, warm. Not corporate. Not a chatbot.
- If data is sparse (few tasks, no habits), keep the briefing short. That is fine.`,
        },
        {
          role: 'user',
          content: `Generate the briefing for ${name}.

ACTIVE GOALS:
${goalsText}

OPEN TASKS (with priority and due dates where available):
${tasksText}

HABITS (active streaks and at-risk only):
${habitsText}

Today: ${today}
Yesterday: ${yesterday}`,
        },
      ],
      maxTokens: 600,
    });

    const title = `Morning Briefing — ${todayLabel()}`;
    const ref = await adminDb.collection('users').doc(uid).collection('conversations').add({
      title,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deleted: false,
      briefing: true,
      read: false,
      messages: [{ id: msgId(), role: 'assistant', content: text }],
    });

    return Response.json({ id: ref.id });
  } catch (e) {
    console.error('[briefing/generate]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
