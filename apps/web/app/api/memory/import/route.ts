import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { upsertMemory } from '@/lib/pinecone';

const MAX_MEMORIES = 500;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  // Rate limit: 3 imports per day
  const todayStr = new Date().toISOString().slice(0, 10);
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};
  const importDate = (userData.importDate as string) ?? '';
  const importCount = (userData.importCount as number) ?? 0;
  if (importDate === todayStr && importCount >= 3) {
    return NextResponse.json({ error: 'Import limit reached (3 per day)' }, { status: 429 });
  }
  await userRef.set({
    importDate: todayStr,
    importCount: importDate === todayStr ? FieldValue.increment(1) : 1,
  }, { merge: true });

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
