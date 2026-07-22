/**
 * Guards the fix for the bug Jeremiah hit on 2026-07-22:
 *
 *   > "it took 30 seconds for it to register and it looked like it was done
 *      because it wasn't doing any typing animation"
 *
 * The typing dots were gated on `messages[last].role !== 'assistant'` (and, on the
 * other surfaces, `=== 'user'`). That reads as "show dots until MODUS replies" but
 * it is NOT what it does, because the assistant message does not appear when the
 * first WORD appears — it appears when the provider request OPENS.
 *
 * This script proves both halves against real code, no API keys needed:
 *
 *   PART 1 (the wire): streamText().toDataStreamResponse() emits a `f:` start_step
 *   part BEFORE any `0:` text part. That part reaches onStartStepPart in
 *   @ai-sdk/ui-utils (dist/index.mjs:1117), which calls execUpdate() and pushes an
 *   assistant message whose content is still "". Everything after that point in
 *   the old condition was false, so the dots hid while the screen was still blank.
 *
 *   PART 2 (the fix): isAwaitingAssistantText keeps the dots up through exactly
 *   that window, and drops them the moment real text — or a streaming ```image /
 *   ```chart block, which owns its own progress bar — is on screen.
 *
 * Run: npx tsx scripts/verify-streaming-indicator.ts
 */
import { streamText } from 'ai';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import type { Message } from 'ai';
import { isAwaitingAssistantText } from '../lib/chat/pending';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
}

function msg(role: 'user' | 'assistant', content: Message['content']): Message {
  return { id: Math.random().toString(36).slice(2), role, content } as Message;
}

(async () => {
  // ── PART 1: what actually goes over the wire ──────────────────────────────
  console.log('\nwire protocol — does the assistant message start before the text?');

  const result = streamText({
    model: new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            // A reasoning model burns its thinking budget here. Nothing visible.
            { type: 'reasoning', textDelta: 'thinking about it' },
            { type: 'text-delta', textDelta: 'Hello' },
            { type: 'text-delta', textDelta: ' there' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 1, completionTokens: 2 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    }),
    prompt: 'hi',
  });

  const body = await result.toDataStreamResponse({ sendReasoning: true }).text();
  const lines = body.split('\n').filter(Boolean);
  const firstText = lines.findIndex(l => l.startsWith('0:'));
  const firstStep = lines.findIndex(l => l.startsWith('f:'));
  const firstReasoning = lines.findIndex(l => l.startsWith('g:'));

  console.log(`        stream opens with: ${lines.slice(0, 3).map(l => JSON.stringify(l)).join(', ')}`);
  check('a start_step (f:) part is emitted at all', firstStep !== -1);
  check(
    'start_step arrives BEFORE the first text part',
    firstStep !== -1 && firstStep < firstText,
    `f: at line ${firstStep}, first 0: at line ${firstText}`,
  );
  check(
    'reasoning also arrives before any visible text',
    firstReasoning !== -1 && firstReasoning < firstText,
    `g: at line ${firstReasoning}, first 0: at line ${firstText}`,
  );

  // ── PART 2: the indicator across that whole window ────────────────────────
  console.log('\nindicator state machine:');

  const user = msg('user', 'how do u route ur models?');

  check('idle, nothing sent → no dots',
    isAwaitingAssistantText([user], false) === false);

  check('sent, server still fetching context → dots',
    isAwaitingAssistantText([user], true) === true);

  // This is the exact frame the old condition got wrong.
  check('🚨 provider opened, assistant message exists but is EMPTY → dots (was: hidden)',
    isAwaitingAssistantText([user, msg('assistant', '')], true) === true);

  check('reasoning model still thinking (content empty) → dots',
    isAwaitingAssistantText([user, msg('assistant', '')], true) === true);

  check('first real token arrived → dots gone',
    isAwaitingAssistantText([user, msg('assistant', 'Hello')], true) === false);

  check('whitespace-only content does not count as an answer → dots',
    isAwaitingAssistantText([user, msg('assistant', '  \n ')], true) === true);

  check('streaming ```image block hands off to its own progress bar → no dots',
    isAwaitingAssistantText([user, msg('assistant', '```image\n{"prompt"')], true) === false);

  check('multimodal parts content is read, not stringified → no dots',
    isAwaitingAssistantText(
      [user, msg('assistant', [{ type: 'text', text: 'Hi' }] as unknown as Message['content'])],
      true,
    ) === false);

  check('finished streaming → no dots',
    isAwaitingAssistantText([user, msg('assistant', 'Hello there')], false) === false);

  check('empty thread, nothing loading → no dots',
    isAwaitingAssistantText([], false) === false);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
