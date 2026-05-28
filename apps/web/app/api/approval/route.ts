import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getValidAccessToken, getAllValidAccessTokens } from '@/lib/google-oauth';
import { sendGmailReply } from '@/lib/gmail-send';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words(s: string) {
  return s.toLowerCase().split(/\s+/).filter(w => w.length > 2);
}

function fuzzyScore(docTitle: string, search: string): number {
  const nd = norm(docTitle);
  const ns = norm(search);
  if (nd === ns) return 1.0;
  if (nd.includes(ns) || ns.includes(nd)) return 0.85;
  // Word overlap — how many search words appear in the doc title
  const sw = words(search);
  const dw = words(docTitle);
  if (sw.length === 0) return 0;
  const hits = sw.filter(w => dw.some(d => d.includes(w) || w.includes(d)));
  return hits.length / sw.length;
}

async function fuzzyFind(colRef: FirebaseFirestore.CollectionReference, searchTitle: string) {
  const snap = await colRef.get();
  let best: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let bestScore = 0;
  for (const doc of snap.docs) {
    const score = fuzzyScore(doc.data().title as string ?? '', searchTitle);
    // Use >= so that among ties (e.g. duplicate habits) we pick the last-ordered doc,
    // giving consistent, distinct results across sequential deletes.
    if (score >= bestScore) { bestScore = score; best = doc; }
  }
  return bestScore >= 0.35 ? best : null;
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, title, description, payload } = await req.json() as {
    type: string;
    title: string;
    description: string;
    payload: Record<string, unknown>;
  };

  const base = {
    title,
    description,
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
    source: 'modus_ai',
  };

  const userRef = adminDb.collection('users').doc(uid);

  switch (type) {
    case 'create_goal': {
      const ref = await userRef.collection('goals').add({ ...base, status: 'active', progress: 0 });
      return Response.json({ id: ref.id });
    }
    case 'create_task': {
      const ref = await userRef.collection('tasks').add({ ...base, done: false, deleted: false });
      return Response.json({ id: ref.id });
    }
    case 'create_habit': {
      const ref = await userRef.collection('habits').add({ ...base, streak: 0, completedDates: [] });
      return Response.json({ id: ref.id });
    }
    case 'schedule_event': {
      const ref = await userRef.collection('events').add(base);
      // Also create in Google Calendar if connected and datetimes provided
      const { startDateTime, endDateTime } = payload as { startDateTime?: string; endDateTime?: string };
      if (startDateTime && endDateTime) {
        try {
          const googleToken = await getValidAccessToken(uid);
          if (googleToken) {
            await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: title,
                description: description ?? '',
                start: { dateTime: startDateTime },
                end: { dateTime: endDateTime },
              }),
            });
          }
        } catch { /* non-fatal — event saved to Firestore regardless */ }
      }
      return Response.json({ id: ref.id });
    }
    case 'archive_email': {
      const threadId = payload.threadId as string | undefined;
      if (!threadId) return Response.json({ error: 'threadId required' }, { status: 400 });
      const googleToken = await getValidAccessToken(uid);
      if (!googleToken) return Response.json({ error: 'Google not connected' }, { status: 400 });
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      });
      if (!res.ok) return Response.json({ error: 'Archive failed' }, { status: 500 });
      return Response.json({ ok: true });
    }
    case 'mark_read_email': {
      const threadId = payload.threadId as string | undefined;
      if (!threadId) return Response.json({ error: 'threadId required' }, { status: 400 });
      const googleToken = await getValidAccessToken(uid);
      if (!googleToken) return Response.json({ error: 'Google not connected' }, { status: 400 });
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      });
      if (!res.ok) return Response.json({ error: 'Mark read failed' }, { status: 500 });
      return Response.json({ ok: true });
    }
    case 'draft_email': {
      const googleToken = await getValidAccessToken(uid);
      if (googleToken) {
        try {
          const to = payload.to as string | undefined;
          const subject = payload.subject as string | undefined ?? title;
          const body = payload.body as string | undefined ?? description;
          const lines = [
            to ? `To: ${to}` : '',
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            body,
          ].filter(Boolean);
          const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
          await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { raw } }),
          });
        } catch { /* non-fatal — draft saved to Firestore regardless */ }
      }
      const ref = await userRef.collection('drafts').add(base);
      return Response.json({ id: ref.id });
    }
    case 'update_goal_progress': {
      const progress = Math.min(100, Math.max(0, Number(payload.progress ?? 0)));
      const goalId = payload.goalId as string | undefined;
      if (goalId) {
        await userRef.collection('goals').doc(goalId).update({ progress, updatedAt: FieldValue.serverTimestamp() });
        return Response.json({ id: goalId });
      }
      const match = await fuzzyFind(userRef.collection('goals'), title);
      if (!match) return Response.json({ error: 'Goal not found' }, { status: 404 });
      await match.ref.update({ progress, updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'update_goal': {
      const goalId = payload.goalId as string | undefined;
      if (goalId) {
        await userRef.collection('goals').doc(goalId).update({ title, ...payload, updatedAt: FieldValue.serverTimestamp() });
        return Response.json({ id: goalId });
      }
      const match = await fuzzyFind(userRef.collection('goals'), title);
      if (!match) return Response.json({ error: 'Goal not found' }, { status: 404 });
      await match.ref.update({ title, ...payload, updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'update_task': {
      const taskId = payload.taskId as string | undefined;
      const { taskId: _tid, ...taskFields } = payload;
      if (taskId) {
        await userRef.collection('tasks').doc(taskId).update({ ...taskFields, updatedAt: FieldValue.serverTimestamp() });
        return Response.json({ id: taskId });
      }
      const match = await fuzzyFind(userRef.collection('tasks'), title);
      if (!match) return Response.json({ error: 'Task not found' }, { status: 404 });
      await match.ref.update({ ...taskFields, updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'update_habit': {
      const habitId = payload.habitId as string | undefined;
      const { habitId: _hid, ...habitFields } = payload;
      if (habitId) {
        await userRef.collection('habits').doc(habitId).update({ ...habitFields, updatedAt: FieldValue.serverTimestamp() });
        return Response.json({ id: habitId });
      }
      const match = await fuzzyFind(userRef.collection('habits'), title);
      if (!match) return Response.json({ error: 'Habit not found' }, { status: 404 });
      await match.ref.update({ ...habitFields, updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'delete_task': {
      const taskId = payload.taskId as string | undefined;
      if (taskId) {
        await userRef.collection('tasks').doc(taskId).update({ deleted: true, deletedAt: FieldValue.serverTimestamp() });
        return Response.json({ id: taskId });
      }
      const match = await fuzzyFind(userRef.collection('tasks'), title);
      if (!match) return Response.json({ error: 'Task not found' }, { status: 404 });
      await match.ref.update({ deleted: true, deletedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'delete_habit': {
      const searchTitle = (payload.habitTitle as string | undefined) || title;
      const match = await fuzzyFind(userRef.collection('habits'), searchTitle);
      if (!match) return Response.json({ error: 'Habit not found — it may have already been deleted.' }, { status: 404 });
      try {
        await match.ref.delete();
      } catch (err) {
        console.error('[approval/delete_habit]', err);
        return Response.json({ error: 'Failed to delete habit. Try again.' }, { status: 500 });
      }
      return Response.json({ id: match.id });
    }
    case 'delete_goal': {
      const searchTitle = (payload.goalTitle as string | undefined) || title;
      const match = await fuzzyFind(userRef.collection('goals'), searchTitle);
      if (!match) return Response.json({ error: 'Goal not found' }, { status: 404 });
      await match.ref.update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
    }
    case 'delete_goal_chat': {
      const conversationId = payload.conversationId as string | undefined;
      if (!conversationId) return Response.json({ error: 'conversationId required' }, { status: 400 });
      if (conversationId.startsWith('goal-')) return Response.json({ error: 'Cannot delete main chat' }, { status: 400 });
      await userRef.collection('conversations').doc(conversationId).update({ deleted: true, deletedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: conversationId });
    }
    case 'create_goal_chat': {
      const goalId = payload.goalId as string | undefined;
      if (!goalId) return Response.json({ error: 'goalId required' }, { status: 400 });
      const ref = await userRef.collection('conversations').add({
        goalId,
        title: title || 'New chat',
        messages: [],
        deleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ id: ref.id });
    }
    case 'send_email': {
      const fromAccount = payload.from_account as string | undefined;
      let googleToken: string | null = null;
      if (fromAccount) {
        const all = await getAllValidAccessTokens(uid);
        googleToken = all.find(a => a.email === fromAccount)?.token ?? null;
      }
      if (!googleToken) googleToken = await getValidAccessToken(uid);
      if (!googleToken) return Response.json({ error: 'Google not connected — reconnect in Settings.' }, { status: 400 });
      if (!payload.to || !payload.body) {
        return Response.json({ error: 'Missing required fields (to, body). Ask MODUS to regenerate the send card.' }, { status: 400 });
      }
      try {
        await sendGmailReply(
          googleToken,
          payload.to as string,
          (payload.subject as string | undefined) ?? title,
          payload.body as string,
          payload.threadId as string | undefined,
        );
      } catch (err) {
        console.error('[approval/send_email]', err);
        const msg = err instanceof Error ? err.message : String(err);
        const isPermission = msg.includes('403') || msg.toLowerCase().includes('insufficient');
        return Response.json({
          error: isPermission
            ? 'Gmail permission denied — reconnect Google in Settings → Connectors to grant send access.'
            : `Failed to send email: ${msg.slice(0, 300)}`,
        }, { status: 500 });
      }
      return Response.json({ ok: true });
    }
    case 'enable_web_search': {
      await userRef.set({ capabilities: { webSearch: true } }, { merge: true });
      return Response.json({ ok: true });
    }
    case 'reschedule_event': {
      const { eventId, calendarId = 'primary', newStart, newEnd } = payload as {
        eventId: string; calendarId?: string; newStart: string; newEnd: string;
      };
      const googleToken = await getValidAccessToken(uid);
      if (!googleToken) return Response.json({ error: 'Google not connected — reconnect in Settings.' }, { status: 400 });
      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: { dateTime: newStart }, end: { dateTime: newEnd } }),
        }
      );
      if (!patchRes.ok) {
        const err = await patchRes.text();
        console.error('[approval/reschedule_event]', err);
        return Response.json({ error: 'Calendar update failed' }, { status: 500 });
      }
      return Response.json({ ok: true });
    }
    case 'create_project_chat': {
      const projectId = payload.projectId as string | undefined;
      if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });
      const ref = await userRef.collection('conversations').add({
        projectId,
        title: title || 'New chat',
        messages: [],
        deleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ id: ref.id });
    }
    case 'delete_project_chat': {
      const conversationId = payload.conversationId as string | undefined;
      if (!conversationId) return Response.json({ error: 'conversationId required' }, { status: 400 });
      if (conversationId.startsWith('project-')) return Response.json({ error: 'Cannot delete main chat' }, { status: 400 });
      await userRef.collection('conversations').doc(conversationId).update({ deleted: true, deletedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: conversationId });
    }
    case 'connect_google':
    case 'connect_notion':
    case 'connect_slack':
    case 'connect_github': {
      return Response.json({ error: 'Use OAuth flow' }, { status: 400 });
    }
    default:
      return Response.json({ error: 'Unknown action type' }, { status: 400 });
  }
}
