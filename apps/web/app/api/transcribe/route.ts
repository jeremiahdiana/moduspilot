import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { whisperFilename } from '@/lib/audio-format';

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

  // Forward a name Whisper can decode from. It detects the format from the
  // EXTENSION, so this is not cosmetic.
  //
  // 🪤 This used to be `(audio as File).name || 'audio.webm'`, and that fallback
  // NEVER FIRED. A raw Blob appended to FormData arrives named "blob" — truthy,
  // no extension — so Whisper rejected every web and desktop upload as an
  // unsupported format, and line 47 below turned that into a bare 500. Voice
  // input was dead on every browser while mobile worked, because mobile uploads a
  // real .m4a file URI. Never trust a client-supplied filename to have a usable
  // extension; derive it from the container type.
  const filename = whisperFilename((audio as File).name, audio.type);
  const groqForm = new FormData();
  groqForm.append('file', audio, filename);
  groqForm.append('model', 'whisper-large-v3');
  groqForm.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  // LOG WHAT GROQ ACTUALLY SAID. Collapsing every upstream failure into a bare
  // 500 is why a dead filename went unnoticed for as long as it did: Whisper was
  // returning a precise "unsupported format" every single time and nobody could
  // see it. The user still gets a generic message; the server keeps the detail.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[transcribe] groq ${res.status} name="${filename}" type="${audio.type}" — ${detail.slice(0, 500)}`);
    return Response.json({ error: 'Transcription failed' }, { status: 500 });
  }
  const data2 = await res.json() as { text: string };
  return Response.json({ text: data2.text });
}
