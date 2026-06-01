import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { FieldValue } from 'firebase-admin/firestore';

function randomId(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const { convId } = await req.json();
  if (!convId) return NextResponse.json({ error: 'Missing convId' }, { status: 400 });

  const userRef = adminDb.collection('users').doc(uid);
  const convRef = userRef.collection('conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = convSnap.data()!;

  // Reuse existing shareId if already shared
  const existingShareId = data.shareId as string | undefined;
  if (existingShareId) {
    return NextResponse.json({ shareId: existingShareId });
  }

  const shareId = randomId();

  await adminDb.collection('sharedConversations').doc(shareId).set({
    uid,
    convId,
    title: data.title ?? 'Untitled',
    messages: (data.messages ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    })),
    createdAt: FieldValue.serverTimestamp(),
  });

  await convRef.update({ shareId });

  return NextResponse.json({ shareId });
}
