import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

// Notification delivery for MODUS Desktop. FCM web-push service workers don't
// run in Electron, so the desktop polls this endpoint for unseen notifications
// (persisted by sendPushToUser) and displays them as native macOS
// notifications, then POSTs back to mark them seen so they aren't shown twice.

interface NotificationDoc {
  title?: string;
  body?: string;
  data?: Record<string, string>;
  seen?: boolean;
  createdAt?: { toMillis?: () => number };
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  // Order by createdAt only (no composite index needed) and filter unseen in
  // memory — notifications worth showing are recent, so the newest 30 covers it.
  const snap = await adminDb
    .collection('users').doc(uid)
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();

  const notifications = snap.docs
    .map((d) => {
      const x = d.data() as NotificationDoc;
      return {
        id: d.id,
        title: x.title ?? 'MODUS',
        body: x.body ?? '',
        data: x.data ?? {},
        seen: x.seen === true,
        createdAt: x.createdAt?.toMillis?.() ?? null,
      };
    })
    .filter((n) => !n.seen);

  return Response.json({ notifications });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 50)
    : [];
  if (ids.length === 0) return Response.json({ ok: true, acked: 0 });

  const col = adminDb.collection('users').doc(uid).collection('notifications');
  const batch = col.firestore.batch();
  for (const id of ids) batch.set(col.doc(id), { seen: true }, { merge: true });
  await batch.commit();

  return Response.json({ ok: true, acked: ids.length });
}
