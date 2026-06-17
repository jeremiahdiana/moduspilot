import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const VALID_KEYS = new Set(['contacts', 'health', 'photos']);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  let body: { key: string; enabled: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!VALID_KEYS.has(body.key) || typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'Invalid key or enabled value' }, { status: 400 });
  }

  await adminDb.collection('users').doc(uid).update({
    [`settings.deviceAccess.${body.key}`]: body.enabled,
  });

  return Response.json({ ok: true });
}
