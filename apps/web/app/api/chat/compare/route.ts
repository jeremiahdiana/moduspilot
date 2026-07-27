import { streamText } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveChatModel } from '@/lib/chat/model';
import { needsExplicitTemperature, maxTokensFor } from '@/lib/chat/model-params';
import { isModelUnlocked, effectivePlan } from '@/lib/models';
import { enforcePaidTokenLimit, trackTokenUsage } from '@/lib/chat/limits';

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

  // 🚨 Compare mode counted NOTHING against the token ceiling and never checked
  // it. The per-hour counter below caps REQUESTS, not spend: 40 calls/hour of
  // Claude Fable 5 at a 16k cap is far past a day's budget, invisibly, and the
  // client fires three of these per comparison. The most expensive surface in the
  // product was the one surface with no cost accounting at all.
  const overBudget = enforcePaidTokenLimit(userData);
  if (overBudget) return overBudget;

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
    // 🪤 BOTH of these were inline regexes here, and BOTH were the buggy spelling
    // that lib/chat/model-params.ts exists to have deleted. The 2026-07-23 fix
    // landed in chat/route.ts only — and because this file has its own streamText
    // call and inherits nothing from it, `claude-opus-4-8` went on being sent
    // temperature:0 (a hard 400) with a 2000-token cap, in compare mode, for
    // another day. Measured on prod 2026-07-24: HTTP 200, 625ms, **0 chars**,
    // while the other nine columns answered.
    //
    // That is the worst place in the product for this bug to live. A dead column
    // does not read as an error — it reads as "Opus lost the comparison", which is
    // precisely the lie this route 503s a silent downgrade to avoid telling.
    //
    // Never re-derive a provider constraint at a second call site. Import it.
    // scripts/verify-compare-params.ts fails if these become literals again.
    maxTokens: maxTokensFor(resolved.modelId),
    ...(needsExplicitTemperature(resolved.modelId) ? { temperature: 1 } : {}),
    onFinish: ({ text, usage }) => {
      console.log(`[compare] ${resolved.modelId} finished in ${Date.now() - started}ms`);
      // Same estimate fallback as chat/route.ts: Gateway-hosted models and
      // gpt-5.6-terra report {promptTokens: null, completionTokens: null}, so a
      // truthiness check on usage silently counts zero for most of the catalog.
      const reported = usage?.totalTokens;
      const total = typeof reported === 'number' && Number.isFinite(reported) && reported > 0
        ? reported
        : Math.ceil((prompt.length + (text?.length ?? 0)) / 4);
      if (total > 0) trackTokenUsage(uid, userData, total, resolved.modelId);
    },
  });

  const res = result.toTextStreamResponse();
  res.headers.set('x-modus-model', resolved.modelId);
  return res;
}

export const maxDuration = 60;
