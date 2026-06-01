import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { approvalHandlers } from '@/lib/approvals';

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

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

  const handler = approvalHandlers[type];
  if (!handler) return Response.json({ error: 'Unknown action type' }, { status: 400 });

  return handler({ uid, userRef, title, description, payload, base });
}
