import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const { shareId, convId } = await req.json();
  if (!shareId || !convId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const sharedRef = adminDb.collection('sharedConversations').doc(shareId);
  const sharedSnap = await sharedRef.get();

  // Verify ownership before deleting
  if (sharedSnap.exists && sharedSnap.data()?.uid !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sharedRef.delete();
  await adminDb.collection('users').doc(uid).collection('conversations').doc(convId).update({
    shareId: FieldValue.delete(),
  });

  return NextResponse.json({ ok: true });
}
