import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { generateBriefingData, briefingDataToText, todayLabel } from '@/lib/briefing';

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

function msgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = adminDb;
  const authAdmin = getAuth(getAdminApp());
  const results: { uid: string; status: string; error?: string }[] = [];

  try {
    const currentUTCHour = new Date().getUTCHours();

    const usersSnap = await db.collection('users').where('onboardingComplete', '==', true).get();
    const dueUsers = usersSnap.docs.filter(d => {
      const hour = d.data()?.settings?.briefingHour ?? 7;
      return hour === currentUTCHour;
    });

    for (const userDoc of dueUsers) {
      const uid = userDoc.id;
      try {
        let name = 'there';
        try {
          const authUser = await authAdmin.getUser(uid);
          name = authUser.displayName?.split(' ')[0] || 'there';
        } catch { /* use fallback */ }

        const today = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [goalsSnap, tasksSnap, habitsSnap, allTasksSnap, contactsSnap] = await Promise.all([
          db.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
          db.collection('users').doc(uid).collection('tasks').where('done', '==', false).get(),
          db.collection('users').doc(uid).collection('habits').get(),
          db.collection('users').doc(uid).collection('tasks').get(),
          db.collection('users').doc(uid).collection('contacts').get(),
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

        const slippedTaskTitles30Days = allTasksSnap.docs
          .filter(d => !d.data().done && !d.data().deleted)
          .map(d => d.data().title as string)
          .slice(0, 20);

        const habitRates30Days = habitsSnap.docs.map(d => ({
          title: d.data().title as string,
          doneOutOf30: ((d.data().completedDates ?? []) as string[]).filter(dt => dt >= thirtyDaysAgo).length,
        }));

        const staleContacts = contactsSnap.docs
          .filter(d => {
            const lastEmail = d.data().lastEmailDate as string ?? '';
            return lastEmail >= thirtyDaysAgo && lastEmail <= sevenDaysAgo;
          })
          .map(d => ({
            name: d.data().name as string,
            daysSince: Math.floor((Date.now() - new Date(d.data().lastEmailDate as string).getTime()) / 86400000),
          }))
          .sort((a, b) => b.daysSince - a.daysSince)
          .slice(0, 3);

        const briefingData = await generateBriefingData(name, {
          goals, tasks, habits, today, yesterday,
          staleContacts: staleContacts.length ? staleContacts : undefined,
          slippedTaskTitles30Days: slippedTaskTitles30Days.length ? slippedTaskTitles30Days : undefined,
          habitRates30Days: habitRates30Days.length ? habitRates30Days : undefined,
        });
        const contentText = briefingDataToText(briefingData);

        const title = `Morning Briefing — ${todayLabel()}`;
        await db.collection('users').doc(uid).collection('conversations').add({
          title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deleted: false,
          briefing: true,
          read: false,
          briefingData,
          messages: [{ id: msgId(), role: 'assistant', content: contentText }],
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
