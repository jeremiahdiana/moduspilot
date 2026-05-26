import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
