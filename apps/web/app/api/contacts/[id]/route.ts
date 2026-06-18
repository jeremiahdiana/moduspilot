import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

const VALID_CATEGORIES = new Set(['personal', 'professional', 'service', 'excluded']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const { id } = params;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  let body: { userCategory: string | null };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // null clears the override (revert to auto-detection)
  if (body.userCategory !== null && !VALID_CATEGORIES.has(body.userCategory)) {
    return Response.json({ error: 'Invalid userCategory' }, { status: 400 });
  }

  const ref = adminDb.collection('users').doc(uid).collection('contacts').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: 'Not found' }, { status: 404 });

  if (body.userCategory === null) {
    const { FieldValue } = await import('firebase-admin/firestore');
    await ref.update({ userCategory: FieldValue.delete() });
  } else {
    await ref.update({ userCategory: body.userCategory });
  }

  return Response.json({ ok: true });
}
