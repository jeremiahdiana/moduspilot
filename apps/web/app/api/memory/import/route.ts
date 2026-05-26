import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { upsertMemory } from '@/lib/pinecone';

const MAX_MEMORIES = 500;

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { memories } = await req.json() as { memories: string[] };
  if (!Array.isArray(memories) || memories.length === 0) {
    return NextResponse.json({ error: 'No memories provided' }, { status: 400 });
  }

  const cleaned = memories
    .map(m => (typeof m === 'string' ? m.trim() : ''))
    .filter(m => m.length > 3)
    .slice(0, MAX_MEMORIES);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'No valid memories after filtering' }, { status: 400 });
  }

  const memoriesRef = adminDb.collection('users').doc(uid).collection('memories');
  const db = memoriesRef.firestore;

  // Firestore batch limit is 500 — cleaned is already capped at 500
  const batch = db.batch();
  for (const content of cleaned) {
    const ref = memoriesRef.doc();
    batch.set(ref, {
      content,
      source: 'imported',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // Pinecone upserts — fire and forget, don't block the response
  if (process.env.PINECONE_API_KEY) {
    Promise.all(
      cleaned.map(content => upsertMemory(uid, content, { type: 'imported_memory', ts: Date.now().toString() }))
    ).catch(e => console.error('[memory/import] Pinecone upsert error:', e));
  }

  return NextResponse.json({ imported: cleaned.length });
}
