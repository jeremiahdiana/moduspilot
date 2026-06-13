import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_CHARS = 4000;
const MAX_PER_DAY = 30;
const ALLOWED_VOICES = new Set(['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']);
const DEFAULT_VOICE = 'onyx';

export async function POST(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;
  const { uid } = authResult;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'TTS not available' }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const d = snap.data() ?? {};

  if (d.ttsDate === today && (d.ttsCount ?? 0) >= MAX_PER_DAY) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json() as { text?: string; voice?: string };
  const text = (body.text ?? '').trim().slice(0, MAX_CHARS);
  if (!text) return Response.json({ error: 'No text provided' }, { status: 400 });

  const voice = ALLOWED_VOICES.has(body.voice ?? '') ? body.voice! : DEFAULT_VOICE;

  await userRef.set({
    ttsDate: today,
    ttsCount: d.ttsDate === today ? FieldValue.increment(1) : 1,
  }, { merge: true });

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'tts-1', input: text, voice }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[tts] OpenAI error', res.status, detail);
    return Response.json({ error: `OpenAI ${res.status}: ${detail}` }, { status: 500 });
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return Response.json({ audio: base64 });
}
