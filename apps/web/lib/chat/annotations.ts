import type { Message } from 'ai';

/**
 * Readers for the message annotations the chat route writes onto an answer.
 *
 * Annotations are how the server tells the client something it could not put in a
 * response header — headers are built synchronously, before the first token, so
 * anything decided during or after the context fetch misses them. They also
 * persist with the thread, so what they say survives a reload.
 *
 * (`readServedAnnotation` still lives in ChatWindow next to its ServedAnnotation
 * type; new readers belong here, where they can be tested without mounting a
 * client component.)
 */

/**
 * How many web results the server injected into this answer, or 0 for none.
 *
 * Written by the chat route as `modusWebSearch` whenever a search actually ran.
 * The count comes from the search itself rather than from re-parsing the prompt
 * block, so the marker on the answer can't drift from what the model was given.
 */
export function readWebSearchAnnotation(m: Message): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anns = (m as any).annotations as any[] | undefined;
  if (!Array.isArray(anns)) return 0;
  for (const a of anns) {
    if (a && typeof a === 'object' && typeof a.modusWebSearch === 'number' && a.modusWebSearch > 0) {
      return a.modusWebSearch;
    }
  }
  return 0;
}
