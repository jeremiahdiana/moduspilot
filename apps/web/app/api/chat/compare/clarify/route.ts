import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireAuth } from '@/lib/api-auth';

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

const SYSTEM = `You decide whether a request needs clarifying before it is sent to several AI models at once.

The user's prompt will be answered by 3 different models in parallel and compared side by side. If the request has a real ambiguity — length, tone, format, audience, scope, or which of several things they meant — every model will guess differently and the comparison will be useless. Ask first.

If the request is clear enough to answer well, or is small talk, or is a simple factual question, reply with exactly:
READY

Otherwise reply with ONLY an options block and nothing else. No prose before or after.

Work out every question you need BEFORE writing the block and put them all in one card (max 3 questions). Give 2-4 concrete options per question, with the likely answers pre-filled as choices. Never ask in prose.

\`\`\`options
{ "questions": [
  { "header": "Length", "question": "How long should it be?", "options": [ { "label": "Short", "detail": "3 tight paragraphs" }, { "label": "Standard", "detail": "5-6 paragraphs with a clear arc" }, { "label": "Long-form", "detail": "Full narrative with sections" } ] },
  { "header": "Tone", "question": "What tone?", "options": [ { "label": "Plain", "detail": "Direct and unadorned" }, { "label": "Persuasive", "detail": "Makes an argument" } ] }
] }
\`\`\`

Rules:
- Only ask what actually changes the answer. Two sharp questions beat four filler ones.
- Never ask something the prompt already states.
- The test is simple: would two good writers, given only this prompt, produce answers that differ in some way the user clearly cares about? If yes, ask. If the request has one obviously good answer, say READY.
- Creative and open-ended work (essays, emails, plans, posts, strategies) almost always needs asking. Facts, math, definitions, small talk, and requests that already state their own format almost never do.`;

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
      system: SYSTEM,
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
