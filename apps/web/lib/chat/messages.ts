import type { CoreMessage } from 'ai';

/**
 * Size/trim helpers for CoreMessage text.
 *
 * 🚨 WHY THESE EXIST, AND WHY THEY DON'T JUST SLICE `content`:
 *
 * `useChat` posts UI-shaped messages — `fillMessageParts()` puts `parts` on every
 * one, and the POST body keeps it even on the default reduced path
 * (@ai-sdk/react:284). `convertToCoreMessages` reads a user turn's text from
 * `parts` and IGNORES `content` when it is present (ai/dist/index.mjs:1750).
 *
 * So the old idiom — `typeof m.content === 'string' ? m.content.slice(0, N) : m`
 * — trimmed a field the model never read. Measured on the real outgoing request:
 * content trimmed to 8,000 chars, 50,000 chars delivered. 6.3x over the cap. It
 * silently disabled BOTH the history budget and the Llama size guard (the valve
 * that exists to stop a free user's request 429ing with "Request too large").
 *
 * The route now normalises to CoreMessage at the boundary, which fixes that — and
 * introduces the opposite trap these helpers exist to absorb: AFTER conversion a
 * user turn's `content` IS AN ARRAY OF PARTS, NOT A STRING, so a `typeof content
 * === 'string'` guard silently matches nothing all over again, just from the other
 * side. Handle both shapes, always.
 */

// CoreMessage['content'] is a per-role union of part arrays, so one map/reduce
// across it doesn't typecheck. The text-bearing shape is identical in every arm;
// narrow to it and cast back at the boundary.
type ContentPart = { type: string; text?: string };

/** Length of a message's TEXT. Images, files and tool parts don't count. */
export function messageTextLength(m: CoreMessage): number {
  if (typeof m.content === 'string') return m.content.length;
  if (!Array.isArray(m.content)) return 0;
  return (m.content as ContentPart[]).reduce((n, p) => n + (p?.type === 'text' ? (p.text ?? '').length : 0), 0);
}

/**
 * Trim a message's text to `max` characters, keeping every non-text part.
 *
 * Attachments must survive: dropping an image to save characters would break
 * vision on the very message the user attached it to.
 */
export function trimMessageText(m: CoreMessage, max: number): CoreMessage {
  if (typeof m.content === 'string') {
    return m.content.length > max ? ({ ...m, content: m.content.slice(0, max) } as CoreMessage) : m;
  }
  if (!Array.isArray(m.content) || messageTextLength(m) <= max) return m;
  let budget = max;
  const parts = (m.content as ContentPart[]).flatMap((p): ContentPart[] => {
    if (p?.type !== 'text') return [p];
    if (budget <= 0) return []; // fully-truncated text part: drop it, don't ship an empty block
    const text = p.text ?? '';
    const next = text.length > budget ? text.slice(0, budget) : text;
    budget -= next.length;
    return [{ ...p, text: next }];
  });
  return { ...m, content: parts } as unknown as CoreMessage;
}
