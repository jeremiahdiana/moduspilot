import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { enforceAuxHourlyLimit } from '@/lib/chat/aux-limit';
import { CLARIFY_SYSTEM, classifyClarifyReply } from '@/lib/chat/clarify-prompt';

// The clarify gate for multi-model mode.
//
// Multi-model sends one prompt to 3 models at once. If the ask is vague ("write
// me an essay"), each model guesses a different length/tone/audience and the
// comparison is worthless — they answered different questions. So MODUS gets one
// cheap turn first to decide whether anything genuinely needs asking.
//
// It only ASKS; it never answers. That is why this is a purpose-built prompt and
// not MODUS_SYSTEM_PROMPT — routing the turn through the full prompt would often
// return a complete answer we'd pay for and throw away, and would drag in
// approval cards, charts, and integrations that make no sense here.
//
// Asking is NOT forced. An unambiguous prompt returns READY and the card fans
// out immediately — a question card in front of an obvious request is friction.

const MAX_PROMPT_CHARS = 4000;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  // Bounded per user per hour. This route calls a model and had no cap at all.
  const limited = await enforceAuxHourlyLimit(auth.uid, 'clarify', 60);
  if (limited) return limited;

  const key = process.env.OPENAI_API_KEY;
  // No key: skip clarifying rather than block the comparison.
  if (!key) return Response.json({ options: null });

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const prompt = String(body.prompt ?? '').slice(0, MAX_PROMPT_CHARS).trim();
  if (!prompt) return Response.json({ error: 'No prompt' }, { status: 400 });

  try {
    const openai = createOpenAI({ apiKey: key });
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0,
      maxTokens: 400,
      system: CLARIFY_SYSTEM,
      prompt,
    });

    const reply = classifyClarifyReply(text);

    // Comparing models only works for written answers, so an artifact request is
    // caught here — before the 3 model calls and the verdict happen at all.
    if (reply.kind === 'unsupported') return Response.json({ unsupported: reply.artifact });
    // Only hand back a block the card can actually render; a malformed payload
    // would stall the comparison behind a card that renders nothing. Everything
    // else (READY, malformed, a prose leak) means "just run it".
    if (reply.kind === 'options') return Response.json({ options: reply.raw });
    return Response.json({ options: null });
  } catch (err) {
    console.error('[compare/clarify] failed:', err);
    return Response.json({ options: null });
  }
}

export const maxDuration = 20;
