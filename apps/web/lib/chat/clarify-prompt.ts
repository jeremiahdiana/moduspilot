/**
 * The multi-model clarify gate's system prompt.
 *
 * Lives here so the route and its eval share ONE copy. They used to hold two,
 * with `// Kept in sync with app/api/chat/compare/clarify/route.ts` as the only
 * thing enforcing it — meaning a change to the shipped prompt would leave
 * scripts/clarify-eval.ts happily green while testing a prompt that no longer
 * existed. A gate that measures the wrong artifact is worse than no gate.
 *
 * Three outcomes: UNSUPPORTED (checked first), an ```options block, or READY.
 *
 * UNSUPPORTED exists because comparing models only works for written answers. In
 * MODUS a model never makes an image — it emits an ```image block and
 * /api/generate/image renders it on OpenAI, the only image provider we have. So
 * three columns could only ever return the same image (identical prompts hit the
 * imageCache) or three images from the SAME model, which compares prompt-writing
 * at triple the cost. Meanwhile the compare route's system prompt never mentions
 * these blocks and a column renders raw markdown, so without this the models just
 * say "I can't make images" — the exact failure lib/claude.ts:131 exists to
 * prevent. Catching it here costs nothing: this call already happens, and the 3
 * model calls plus the verdict never do.
 *
 * ⚠️ scripts/clarify-eval.ts is the gate for this file. Run it before AND after
 * any edit here — and baseline first, because gpt-4o-mini drifts on its own.
 *
 * The UNSUPPORTED rule is ONE terse bullet at the end, ending in one concrete
 * counter-example. Every word was measured by interleaved A/B against the shipped
 * prompt — interleaved because this model drifts over TIME, so running the arms
 * back to back lies. What was tried and rejected:
 *   - Stating it up front, ahead of the ask/READY rules: the gate resolved early
 *     and stopped asking. "essay on the telephone" 4/4 ask -> 0/4, and "make me a
 *     logo" leaked into prose 2/2.
 *   - "One exception overrides everything above / ignore the rules above": it
 *     discounted the ask rules wholesale. "help me plan my week" 4/4 -> 0/4.
 *   - A broad clarifier ("writing that merely concerns those things is ordinary
 *     writing"): "help me plan my week" 4/4 -> 1/4. A general PRINCIPLE bleeds
 *     into decisions it was never about.
 *   - Dropping chart to dodge the false positive: "chart my revenue" then came
 *     back as UNSUPPORTED: document.
 * What works is the single example: without it "explain how charts work" fires
 * UNSUPPORTED: chart 3/3 (it triggers on the NOUN, not the verb); with it, 0/3,
 * and nothing else moves. A concrete example stays scoped where a rule does not.
 * Adding reassurance here has only ever made it worse. Measure, don't add.
 */
export const CLARIFY_SYSTEM = `You decide whether a request needs clarifying before it is sent to several AI models at once.

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
- Creative and open-ended work (essays, emails, plans, posts, strategies) almost always needs asking. Facts, math, definitions, small talk, and requests that already state their own format almost never do.
- Only written answers can be compared: if the user asks you to MAKE a picture/image/illustration/logo, a PDF/document/file, or a chart/graph, reply with exactly \`UNSUPPORTED: image\`, \`UNSUPPORTED: document\` or \`UNSUPPORTED: chart\` and nothing else. "Explain how charts work" asks for text, so it is not this.`;

export type ClarifyArtifact = 'image' | 'document' | 'chart';

export type ClarifyReply =
  | { kind: 'unsupported'; artifact: ClarifyArtifact }
  | { kind: 'options'; raw: string }
  | { kind: 'ready' }
  /** An options block the card could not render — treated as no block. */
  | { kind: 'malformed'; raw: string }
  /** Neither a block nor READY: the gate answered instead of deciding. */
  | { kind: 'prose'; text: string };

/**
 * Read the gate's reply. Shared by the route and the eval for the same reason
 * the prompt is: two hand-synced parsers drift, and then the eval scores a
 * behaviour the route does not have.
 *
 * Order matters and mirrors the prompt — UNSUPPORTED is checked first.
 */
export function classifyClarifyReply(text: string): ClarifyReply {
  const u = /UNSUPPORTED:\s*(image|document|chart)/i.exec(text);
  if (u) return { kind: 'unsupported', artifact: u[1].toLowerCase() as ClarifyArtifact };

  const m = /```options\s*([\s\S]*?)```/.exec(text);
  if (m) {
    const raw = m[1].trim();
    try {
      const p = JSON.parse(raw) as { questions?: unknown[]; question?: string };
      const ok = (Array.isArray(p.questions) && p.questions.length > 0) || typeof p.question === 'string';
      return ok ? { kind: 'options', raw } : { kind: 'malformed', raw };
    } catch {
      return { kind: 'malformed', raw };
    }
  }

  if (/^READY\s*$/i.test(text.trim())) return { kind: 'ready' };
  return { kind: 'prose', text: text.trim() };
}
