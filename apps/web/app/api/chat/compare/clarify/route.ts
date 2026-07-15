import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireAuth } from '@/lib/api-auth';
import { CLARIFY_SYSTEM } from '@/lib/chat/clarify-prompt';

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

    const m = /```options\s*([\s\S]*?)```/.exec(text);
    if (!m) return Response.json({ options: null });

    // Only hand back a block the card can actually render — a malformed payload
    // would otherwise stall the comparison behind a card that renders nothing.
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw) as { questions?: unknown[]; question?: string };
      const ok = (Array.isArray(parsed.questions) && parsed.questions.length > 0)
        || typeof parsed.question === 'string';
      if (!ok) return Response.json({ options: null });
    } catch {
      return Response.json({ options: null });
    }

    return Response.json({ options: raw });
  } catch (err) {
    console.error('[compare/clarify] failed:', err);
    return Response.json({ options: null });
  }
}

export const maxDuration = 20;
