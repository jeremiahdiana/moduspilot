import { streamText } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveChatModel } from '@/lib/chat/model';
import { isModelUnlocked, effectivePlan } from '@/lib/models';

// Compare mode: the same prompt answered by up to 3 models side by side.
//
// One model PER REQUEST. The client fires three of these in parallel, so each
// column streams independently and a slow model never blocks the other two.
// Fanning all three through a single response would have meant multiplexing
// three streams down one pipe and re-splitting them client side, for no gain.
//
// Deliberately NOT the full MODUS system prompt: this compares raw model
// quality on a question, and a 5.3k-token prompt x3 would triple the cost of
// every comparison while making the answers less distinguishable.

const MAX_PER_HOUR = 40; // counts single-model calls, so ~13 comparisons/hour
const MAX_PROMPT_CHARS = 4000;

const SYSTEM = 'Answer the user directly and concisely. Use markdown when it helps. Do not mention which model you are.';

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { uid } = auth;

  let body: { prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const prompt = String(body.prompt ?? '').slice(0, MAX_PROMPT_CHARS).trim();
  const modelId = String(body.model ?? '');
  if (!prompt) return Response.json({ error: 'No prompt' }, { status: 400 });
  if (!modelId) return Response.json({ error: 'No model' }, { status: 400 });

  const userSnap = await adminDb.collection('users').doc(uid).get();
  const userData = userSnap.data() ?? {};
  const plan = userData.plan as string | undefined;

  // Plan gate is server-side: the client picking a locked model in the UI must
  // never be what decides whether a paid model runs.
  if (!isModelUnlocked(modelId, effectivePlan(plan))) {
    return Response.json({ error: 'Model not available on your plan', code: 'model_locked' }, { status: 402 });
  }

  const nowHour = new Date().toISOString().slice(0, 13);
  if (userData.compareHour === nowHour && (userData.compareCount ?? 0) >= MAX_PER_HOUR) {
    return Response.json({ error: 'Rate limit: too many comparisons this hour' }, { status: 429 });
  }
  await adminDb.collection('users').doc(uid).set({
    compareHour: nowHour,
    compareCount: userData.compareHour === nowHour ? FieldValue.increment(1) : 1,
  }, { merge: true });

  const resolved = resolveChatModel(userData, { modelId });
  // resolveChatModel silently falls back to free Llama when a provider key is
  // missing. In compare mode that would quietly show the same model in two
  // columns, so refuse instead of lying about which model answered.
  if (resolved.downgraded) {
    return Response.json({ error: 'That model is not configured', code: 'model_unavailable' }, { status: 503 });
  }

  const started = Date.now();
  const result = streamText({
    model: resolved.model,
    system: SYSTEM,
    prompt,
    // 900 could not deliver what the clarify gate OFFERS. That card's own
    // example options include "Long-form — Full narrative with sections", and
    // 900 tokens is ~675 words: pick long-form and the answer was guaranteed to
    // stop mid-sentence, in all three columns, with nothing saying why. Never
    // offer a length the pipe behind it cannot carry.
    //
    // This is a cap, not a target — a short answer bills what it generates, so
    // raising it costs nothing except on the long answers the user asked for.
    //
    // Reasoning models need their own budget for the same reason chat/route.ts
    // does: gpt-5.x and the o-series spend hidden reasoning tokens against this
    // cap, and gpt-5.6-sol measurably burns 2048/2048 on a hard prompt and emits
    // NOTHING. A blank column would read as "that model lost", which is exactly
    // the lie compare mode refuses above when it 503s a downgrade.
    //
    // The Claude 5 family belongs here too — measured 2026-07-17, claude-sonnet-5
    // returns 0 chars at 2048 and 3541 at 16000. Sonnet 5 losing a race it never
    // got to run is the exact failure this comment is about.
    // gemini-3.x too — measured 2026-07-17: gemini-3.5-flash truncates at 2048
    // (finish 'length', 881 chars) and completes at 16000 (2258). A half-finished
    // Gemini column is the same lie as a blank one.
    maxTokens: /^o\d/.test(resolved.modelId) || /^gpt-5/.test(resolved.modelId) || /-5$/.test(resolved.modelId) || /^gemini-3/.test(resolved.modelId) ? 16000 : 2000,
    // Claude 5 rejects the AI SDK's hardcoded temperature:0 with a 400 on EVERY
    // request; Anthropic's default of 1 is accepted. See chat/route.ts for the full
    // note — this file has its own streamText call and inherits nothing from it.
    ...(/^claude-.*-5$/.test(resolved.modelId) ? { temperature: 1 } : {}),
    onFinish: () => {
      console.log(`[compare] ${resolved.modelId} finished in ${Date.now() - started}ms`);
    },
  });

  const res = result.toTextStreamResponse();
  res.headers.set('x-modus-model', resolved.modelId);
  return res;
}

export const maxDuration = 60;
