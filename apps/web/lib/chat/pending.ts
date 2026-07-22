import type { Message } from 'ai';

/** A UI message's plain text, whether it's a bare string or multimodal parts. */
export function uiMessageText(m: Message | undefined): string {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = m.content as any[];
  if (!Array.isArray(parts)) return '';
  return parts.filter(p => p?.type === 'text').map(p => (p.text as string) ?? '').join('\n');
}

/**
 * True while a request is in flight and MODUS has not yet put a single visible
 * character on screen — i.e. EXACTLY when the typing dots must be showing.
 *
 * 🚨 DO NOT REWRITE THIS AS `messages[last].role !== 'assistant'`. That is the bug
 * this function exists to kill, and all four chat surfaces shipped with a variant
 * of it.
 *
 * The assistant message does NOT appear when the first word does. streamText emits
 * a `step-start` part the instant the provider request opens (ai@4.3.19
 * dist/index.mjs:6273, unconditional), which reaches onStartStepPart in
 * @ai-sdk/ui-utils (dist/index.mjs:1117) and calls execUpdate() — pushing an
 * assistant message whose `content` is still "". So:
 *
 *   1. the dots hide, because the last message is now an assistant message
 *   2. MessageBubble renders nothing, because it guards on `part.value.trim()`
 *   3. the screen sits blank, with no animation, until the first real token
 *
 * On a reasoning model that gap is the whole thinking phase: reasoning deltas
 * accumulate into `message.reasoning` and never touch `message.content`, and the
 * route gives them a 16000-token budget to spend before emitting a visible
 * character. The user reads a still, empty screen as a finished — or broken —
 * answer, which is precisely the report: "it looked like it was done because it
 * wasn't doing any typing animation."
 *
 * Keying on TEXT rather than on ROLE covers all of it, including the tool-call
 * pause mid-answer. Note this reads the raw content, not MessageBubble's
 * block-stripped version, so a streaming ```image / ```chart block counts as
 * visible output and hands off to that card's own progress bar instead of
 * double-rendering an indicator next to it.
 */
export function isAwaitingAssistantText(messages: Message[], isLoading: boolean): boolean {
  if (!isLoading) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return true;
  return uiMessageText(last).trim().length === 0;
}
