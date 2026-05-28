import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateBriefingData, briefingDataToText, todayLabel } from '@/lib/briefing';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';
import { sendPushToUser } from '@/lib/fcm-admin';

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

    // Dedup: if a briefing already exists for today, return it
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const existingSnap = await adminDb
      .collection('users').doc(uid).collection('conversations')
      .where('briefing', '==', true)
      .where('createdAt', '>=', Timestamp.fromDate(todayStart))
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return Response.json({ existing: true, id: existingSnap.docs[0].id });
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [userDoc, goalsSnap, tasksSnap, habitsSnap, allTasksSnap, contactsSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('users').doc(uid).collection('goals').where('status', '==', 'active').get(),
      adminDb.collection('users').doc(uid).collection('tasks').where('done', '==', false).get(),
      adminDb.collection('users').doc(uid).collection('habits').get(),
      adminDb.collection('users').doc(uid).collection('tasks').get(),
      adminDb.collection('users').doc(uid).collection('contacts').get(),
    ]);

    const userTimezone: string = userDoc.data()?.settings?.briefingTimezone ?? 'America/Los_Angeles';

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

    // 30-day pattern data
    const slippedTaskTitles30Days = allTasksSnap.docs
      .filter(d => !d.data().done && !d.data().deleted)
      .map(d => d.data().title as string)
      .slice(0, 20);

    const habitRates30Days = habitsSnap.docs.map(d => {
      const completedDates = (d.data().completedDates ?? []) as string[];
      return { title: d.data().title as string, doneOutOf30: completedDates.filter(dt => dt >= thirtyDaysAgo).length };
    });

    // Stale contacts — emailed within 30 days but no reply logged in 7+ days
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

    // Fetch calendar events if Google is connected
    let schedule: { time: string; title: string }[] = [];
    try {
      const googleToken = await getValidAccessToken(uid);
      if (googleToken) {
        const events = await getTodayEvents(googleToken, userTimezone);
        const seen = new Set<string>();
        schedule = events
          .filter(e => !e.allDay)
          .filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          })
          .map(e => ({ time: fmtEventTime(e.start, userTimezone), title: e.title }));
      }
    } catch {}

    const briefingData = await generateBriefingData(name, {
      goals, tasks, habits, today, yesterday, schedule,
      staleContacts: staleContacts.length ? staleContacts : undefined,
      slippedTaskTitles30Days: slippedTaskTitles30Days.length ? slippedTaskTitles30Days : undefined,
      habitRates30Days: habitRates30Days.length ? habitRates30Days : undefined,
    });
    const contentText = briefingDataToText(briefingData);

    const title = `Morning Briefing — ${todayLabel()}`;
    const ref = await adminDb.collection('users').doc(uid).collection('conversations').add({
      title,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deleted: false,
      briefing: true,
      read: false,
      briefingData,
      messages: [{ id: msgId(), role: 'assistant', content: contentText }],
    });

    // Fire-and-forget push notification
    sendPushToUser(uid, 'Morning Briefing ready', briefingData.openingLine ?? 'Your MODUS briefing is ready.').catch(() => {});

    return Response.json({ id: ref.id, briefingData });
  } catch (e) {
    console.error('[briefing/generate]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
