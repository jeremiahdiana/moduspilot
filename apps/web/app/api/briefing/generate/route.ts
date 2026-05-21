import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateBriefingData, briefingDataToText, todayLabel } from '@/lib/briefing';
import { getValidAccessToken } from '@/lib/google-oauth';
import { getTodayEvents, fmtEventTime } from '@/lib/google-calendar';

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

    // Fetch calendar events if Google is connected
    let schedule: { time: string; title: string }[] = [];
    try {
      const googleToken = await getValidAccessToken(uid);
      if (googleToken) {
        const events = await getTodayEvents(googleToken);
        schedule = events
          .filter(e => !e.allDay)
          .map(e => ({ time: fmtEventTime(e.start), title: e.title }));
      }
    } catch {}

    const briefingData = await generateBriefingData(name, { goals, tasks, habits, today, yesterday, schedule });
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

    return Response.json({ id: ref.id, briefingData });
  } catch (e) {
    console.error('[briefing/generate]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
