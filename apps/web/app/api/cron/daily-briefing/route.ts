import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { FieldValue } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

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

async function generateBriefing(name: string, data: {
  goals: { title: string; progress: number; status: string }[];
  tasks: { title: string; priority?: string }[];
  habits: { title: string; streak: number; completedDates: string[] }[];
}): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  const goalsText = data.goals.length
    ? data.goals.map(g => `- ${g.title} (${g.progress ?? 0}% complete)`).join('\n')
    : 'No active goals yet.';

  const tasksText = data.tasks.length
    ? data.tasks.slice(0, 8).map(t => `- ${t.title}${t.priority ? ` [${t.priority}]` : ''}`).join('\n')
    : 'No open tasks.';

  const habitsText = data.habits.length
    ? data.habits.map(h => {
        const doneToday = h.completedDates?.includes(today);
        return `- ${h.title} — ${h.streak ?? 0} day streak${doneToday ? ' ✓' : ''}`;
      }).join('\n')
    : 'No habits tracked yet.';

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    messages: [
      {
        role: 'system',
        content: `You are MODUS, an AI chief of staff. You write sharp, direct morning briefings — no fluff, no filler. Your tone is a trusted advisor who knows the user's life deeply. Use markdown. Be concise. Max 250 words. Never use em dashes. Never say "I hope" or "I trust" or anything sycophantic.`,
      },
      {
        role: 'user',
        content: `Write a morning briefing for ${name} on ${todayLabel()}.

Their current data:

ACTIVE GOALS:
${goalsText}

OPEN TASKS:
${tasksText}

HABITS:
${habitsText}

Format:
- One sharp opening line (no generic "Good morning" — make it specific to their situation)
- **Top 3 priorities today** (pick the most important tasks or goal actions)
- **Habits** (which ones aren't done today, encourage streak protection)
- **One thing to remember** (a brief insight or pattern you notice from their data)

Keep it tight. This is the first thing they read.`,
      },
    ],
  });

  return text;
}

export async function GET(req: Request) {
  // Verify Vercel cron secret
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = adminDb;
  const authAdmin = getAuth(getAdminApp());
  const results: { uid: string; status: string; error?: string }[] = [];

  try {
    const currentUTCHour = new Date().getUTCHours();

    // Get all users with onboarding complete, filter to those whose briefing hour matches now
    const usersSnap = await db.collection('users').where('onboardingComplete', '==', true).get();
    const dueUsers = usersSnap.docs.filter(d => {
      const hour = d.data()?.settings?.briefingHour ?? 7;
      return hour === currentUTCHour;
    });

    for (const userDoc of dueUsers) {
      const uid = userDoc.id;
      try {
        // Get display name from Firebase Auth
        let name = 'there';
        try {
          const authUser = await authAdmin.getUser(uid);
          name = authUser.displayName?.split(' ')[0] || 'there';
        } catch { /* use fallback */ }

        // Fetch goals, tasks, habits in parallel
        const [goalsSnap, tasksSnap, habitsSnap] = await Promise.all([
          db.collection('users').doc(uid).collection('goals')
            .where('status', '==', 'active').get(),
          db.collection('users').doc(uid).collection('tasks')
            .where('done', '==', false).get(),
          db.collection('users').doc(uid).collection('habits').get(),
        ]);

        const goals = goalsSnap.docs
          .filter(d => !d.data().deleted)
          .map(d => ({ title: d.data().title, progress: d.data().progress ?? 0, status: d.data().status }));

        const tasks = tasksSnap.docs
          .filter(d => !d.data().deleted)
          .map(d => ({ title: d.data().title, priority: d.data().priority }));

        const habits = habitsSnap.docs.map(d => ({
          title: d.data().title,
          streak: d.data().streak ?? 0,
          completedDates: d.data().completedDates ?? [],
        }));

        const briefingText = await generateBriefing(name, { goals, tasks, habits });

        // Save as a new conversation in Firestore
        const title = `Morning Briefing — ${todayLabel()}`;
        await db.collection('users').doc(uid).collection('conversations').add({
          title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deleted: false,
          briefing: true,
          messages: [
            {
              id: msgId(),
              role: 'assistant',
              content: briefingText,
            },
          ],
        });

        results.push({ uid, status: 'ok' });
      } catch (err) {
        console.error(`[daily-briefing] failed for uid ${uid}:`, err);
        results.push({ uid, status: 'error', error: String(err) });
      }
    }

    return Response.json({ utcHour: currentUTCHour, due: dueUsers.length, sent: results.length, results });
  } catch (err) {
    console.error('[daily-briefing] fatal:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
