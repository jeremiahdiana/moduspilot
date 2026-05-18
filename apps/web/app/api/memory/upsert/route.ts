import { adminAuth } from '@/lib/firebase-admin';
import { upsertMemory } from '@/lib/pinecone';

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

  if (!process.env.PINECONE_API_KEY) return Response.json({ ok: true });

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) return Response.json({ error: 'No text' }, { status: 400 });

  await upsertMemory(uid, text.trim(), { type: 'manual_memory', ts: Date.now().toString() });
  return Response.json({ ok: true });
}
