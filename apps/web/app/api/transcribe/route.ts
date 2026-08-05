import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { whisperFilename } from '@/lib/audio-format';
import { isPaidPlan } from '@/lib/plan';
import { PAID_TRANSCRIBE_SECONDS_PER_DAY, FREE_TRANSCRIBE_SECONDS_LIFETIME } from '@/lib/constants';

// 💸 THE BUDGET IS SECONDS OF AUDIO, because that is what Whisper bills.
//
// It used to be 120 REQUESTS/hour against a 25MB body. Those two numbers do not
// bound spend in any useful way: one request may legally carry an hour of audio,
// so the cap authorised roughly 2,880 requests a day of arbitrary length. Same
// shape as the old TTS call cap and the old watch "12 looks an hour".
//
// Free gets a LIFETIME pot to match the lifetime chat allowance; paid gets a daily
// one. Derived in lib/constants.ts, asserted by scripts/verify-surface-costs.ts.
const MAX_BYTES = 8 * 1024 * 1024; // a voice note, not a podcast (Groq's own cap is 25MB)

export async function POST(req: Request) {
  // Require auth — this proxies to a paid Groq endpoint with our key, so it
  // must never be an open, unmetered endpoint anyone can drain.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const today = new Date().toISOString().slice(0, 10);
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};
  const paid = isPaidPlan(data.plan as string | undefined) || data.preLaunchAccess === true;
  const budget = paid ? PAID_TRANSCRIBE_SECONDS_PER_DAY : FREE_TRANSCRIBE_SECONDS_LIFETIME;
  const spent = paid
    ? (data.sttSecondsDate === today ? (data.sttSecondsToday ?? 0) : 0)
    : (data.sttSecondsLifetime ?? 0);

  // Checked BEFORE the call from the running total, then reconciled with the real
  // duration after. Whisper only reports duration once it has decoded the file, so
  // a pre-flight check can overshoot by at most one clip — bounded, and far better
  // than charging nothing at all, which is what a request counter did.
  if (spent >= budget) {
    return Response.json({
      error: paid ? 'Daily voice limit reached' : 'That is all the free transcription on this account.',
      code: paid ? 'stt_daily_limit' : 'stt_free_exhausted',
    }, { status: 429 });
  }

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
  // verbose_json so the response carries `duration` — the only place the SECONDS
  // we are billed for actually appear. Plain json returns text alone, which is why
  // this route could never account for what it spent.
  groqForm.append('response_format', 'verbose_json');

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
  const data2 = await res.json() as { text: string; duration?: number };

  // Charge the REAL duration. Falls back to the whole remaining budget when the
  // provider omits it, so a missing field can never make transcription free.
  const seconds = Number.isFinite(data2.duration) && (data2.duration ?? 0) > 0
    ? Math.ceil(data2.duration as number)
    : Math.max(1, budget - spent);
  await userRef.set(paid
    ? { sttSecondsDate: today, sttSecondsToday: spent + seconds }
    : { sttSecondsLifetime: spent + seconds },
  { merge: true }).catch(() => {});

  return Response.json({ text: data2.text });
}
