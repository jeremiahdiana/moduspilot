import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_PER_HOUR = 120;          // generous: voice is one call per message
const MAX_BYTES = 25 * 1024 * 1024; // Groq Whisper hard limit is 25MB

export async function POST(req: Request) {
  // Require auth — this proxies to a paid Groq endpoint with our key, so it
  // must never be an open, unmetered endpoint anyone can drain.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  // Per-user hourly cap to bound cost/abuse.
  const nowHour = new Date().toISOString().slice(0, 13); // "2026-06-02T14"
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};
  if (data.transcribeHour === nowHour && (data.transcribeCount ?? 0) >= MAX_PER_HOUR) {
    return Response.json({ error: 'Rate limit: too many transcriptions this hour' }, { status: 429 });
  }
  await userRef.set({
    transcribeHour: nowHour,
    transcribeCount: data.transcribeHour === nowHour ? FieldValue.increment(1) : 1,
  }, { merge: true });

  const formData = await req.formData();
  const audio = formData.get('audio') as File;
  if (!audio) return Response.json({ error: 'No audio' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'Audio too large' }, { status: 413 });

  // Forward with the uploaded file's real name so Whisper detects the format
  // correctly (web sends .webm, iOS sends .m4a). Falls back to .webm.
  const filename = (audio as File).name || 'audio.webm';
  const groqForm = new FormData();
  groqForm.append('file', audio, filename);
  groqForm.append('model', 'whisper-large-v3');
  groqForm.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!res.ok) return Response.json({ error: 'Transcription failed' }, { status: 500 });
  const data2 = await res.json() as { text: string };
  return Response.json({ text: data2.text });
}
