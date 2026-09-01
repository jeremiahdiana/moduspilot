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

export interface AttachmentMeta { name: string; text: string }

/**
 * Files the user attached to THIS message. Written client-side (not by the route)
 * as a `modusAttachments` annotation so the attachment persists with the thread
 * and survives a reload — the extracted text otherwise lived only in the single
 * request's system prompt and was lost the moment the turn ended. The chip reads
 * the names; the composer reads the text back to keep the document in context on
 * follow-up turns. The server never reads annotations, so this does not double-
 * inject the text into the model prompt.
 */
export function readAttachmentsAnnotation(m: Message): AttachmentMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anns = (m as any).annotations as any[] | undefined;
  if (!Array.isArray(anns)) return [];
  for (const a of anns) {
    if (a && typeof a === 'object' && Array.isArray(a.modusAttachments)) {
      return (a.modusAttachments as unknown[])
        .filter((x): x is AttachmentMeta => !!x && typeof (x as AttachmentMeta).name === 'string')
        .map((x) => ({ name: x.name, text: typeof x.text === 'string' ? x.text : '' }));
    }
  }
  return [];
}
