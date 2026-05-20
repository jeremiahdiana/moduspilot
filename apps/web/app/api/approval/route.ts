import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
    if (score > bestScore) { bestScore = score; best = doc; }
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
      return Response.json({ id: ref.id });
    }
    case 'draft_email': {
      const ref = await userRef.collection('drafts').add(base);
      return Response.json({ id: ref.id });
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
      if (!match) return Response.json({ error: 'Habit not found' }, { status: 404 });
      await match.ref.delete();
      return Response.json({ id: match.id });
    }
    case 'delete_goal': {
      const searchTitle = (payload.goalTitle as string | undefined) || title;
      const match = await fuzzyFind(userRef.collection('goals'), searchTitle);
      if (!match) return Response.json({ error: 'Goal not found' }, { status: 404 });
      await match.ref.update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp() });
      return Response.json({ id: match.id });
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
    default:
      return Response.json({ error: 'Unknown action type' }, { status: 400 });
  }
}
