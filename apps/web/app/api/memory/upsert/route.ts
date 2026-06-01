import { requireAuth } from '@/lib/api-auth';
import { upsertMemory } from '@/lib/pinecone';

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  if (!process.env.PINECONE_API_KEY) return Response.json({ ok: true });

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) return Response.json({ error: 'No text' }, { status: 400 });

  await upsertMemory(uid, text.trim(), { type: 'manual_memory', ts: Date.now().toString() });
  return Response.json({ ok: true });
}
