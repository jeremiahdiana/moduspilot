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

/**
 * Remove unpaired surrogates.
 *
 * 🪤 A LONE SURROGATE IS NOT VALID JSON, AND THE PROVIDER REJECTS THE WHOLE
 * REQUEST — a 200 with zero characters, i.e. a blank bubble. Measured against
 * prod 2026-07-23:
 *
 *   AI_APICallError: The request body is not valid JSON:
 *   no low surrogate in string: line 1 column 27143
 *   PineconeBadRequestError: unexpected end of hex escape
 *
 * This is NOT an exotic input. `trimMessageText` below slices by UTF-16 code
 * UNIT, and every emoji is two of them — so cutting a long message at the
 * history budget lands mid-emoji roughly one time in two whenever the boundary
 * falls on one. An ordinary long message with emoji in it could do this by
 * itself. (The slice is now pair-aware too; this is the belt to that's braces,
 * because surrogates also arrive from clients, clipboards and mobile keyboards.)
 */
export function stripLoneSurrogates(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

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
/**
 * Slice without ever splitting a surrogate pair.
 *
 * `"🔥".slice(0, 1)` yields half an emoji — an unpaired high surrogate, which
 * makes the outgoing JSON invalid and costs the user their whole answer. Back
 * off one unit when the cut lands between a pair.
 */
function safeSlice(s: string, max: number): string {
  if (s.length <= max) return s;
  const code = s.charCodeAt(max - 1);
  // High surrogate at the cut → its partner is at `max`, so drop it too.
  const end = code >= 0xd800 && code <= 0xdbff ? max - 1 : max;
  return s.slice(0, end);
}

export function trimMessageText(m: CoreMessage, max: number): CoreMessage {
  if (typeof m.content === 'string') {
    return m.content.length > max ? ({ ...m, content: safeSlice(m.content, max) } as CoreMessage) : m;
  }
  if (!Array.isArray(m.content) || messageTextLength(m) <= max) return m;
  let budget = max;
  const parts = (m.content as ContentPart[]).flatMap((p): ContentPart[] => {
    if (p?.type !== 'text') return [p];
    if (budget <= 0) return []; // fully-truncated text part: drop it, don't ship an empty block
    const text = p.text ?? '';
    const next = text.length > budget ? safeSlice(text, budget) : text;
    budget -= next.length;
    return [{ ...p, text: next }];
  });
  return { ...m, content: parts } as unknown as CoreMessage;
}
