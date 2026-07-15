import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Names a conversation from its first exchange. Titles used to be the first 45
// characters of the user's message, which produced "Show how $10,000 grows over
// 20 years with ann" and, for a message of ".", a title of ".".
//
// gpt-4o-mini, ~200 tokens in / ~8 out => ~$0.00003 per chat. Cheap enough to
// run on every new conversation, but it is still an authed, rate-limited,
// key-spending endpoint.

const MAX_PER_HOUR = 60;
const MAX_TITLE_CHARS = 60;

/** Strip rendered block payloads — the model should title the intent, not JSON. */
function clean(text: string): string {
  return text
    .replace(/```(approval|draft_options|options|image|document|chart)[\s\S]*?```/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The model is told to return bare text, but it still likes quotes and periods. */
function tidy(raw: string): string {
  let t = raw.trim().split('\n')[0].trim();
  t = t.replace(/^["'`]|["'`]$/g, '').replace(/[.]+$/, '').trim();
  if (t.length > MAX_TITLE_CHARS) t = t.slice(0, MAX_TITLE_CHARS).trimEnd();
  return t;
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  const key = process.env.OPENAI_API_KEY;
  // No key: the caller keeps whatever title it already derived. Not an error.
  if (!key) return Response.json({ title: null });

  let body: { userMessage?: string; assistantMessage?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const userMessage = clean(String(body.userMessage ?? '')).slice(0, 600);
  const assistantMessage = clean(String(body.assistantMessage ?? '')).slice(0, 600);
  if (!userMessage) return Response.json({ title: null });

  // Per-user hourly cap. Mirrors /api/transcribe.
  const nowHour = new Date().toISOString().slice(0, 13);
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};
  if (data.titleHour === nowHour && (data.titleCount ?? 0) >= MAX_PER_HOUR) {
    return Response.json({ title: null });
  }
  await userRef.set({
    titleHour: nowHour,
    titleCount: data.titleHour === nowHour ? FieldValue.increment(1) : 1,
  }, { merge: true });

  try {
    const openai = createOpenAI({ apiKey: key });
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.2,
      maxTokens: 16,
      system:
        'You name chat conversations. Reply with ONLY a title of 3 to 5 words that captures what the ' +
        'conversation is about. Use sentence case. No quotes, no punctuation at the end, no emoji, and ' +
        'never prefix it with "Title:". If the exchange is only a greeting or small talk, reply exactly: ' +
        'Quick hello',
      prompt: `User: ${userMessage}\n\nAssistant: ${assistantMessage}\n\nTitle:`,
    });

    const title = tidy(text);
    // A blank or one-character title is worse than the caller's fallback.
    if (title.length < 2) return Response.json({ title: null });
    return Response.json({ title });
  } catch (err) {
    console.error('[chat/title] generation failed:', err);
    return Response.json({ title: null });
  }
}

export const maxDuration = 15;
