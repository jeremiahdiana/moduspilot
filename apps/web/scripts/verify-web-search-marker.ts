/**
 * Guards the "Searched the web · N results" marker.
 *
 * Web search left NO trace on an answer. Results were injected with a "cite
 * sources naturally" instruction and nothing on the reply said the web had been
 * consulted, so a web-sourced answer was indistinguishable from the model's own
 * knowledge. That is how "According to Dapto..." reached a question about MODUS
 * with nothing looking wrong.
 *
 * The risky part is the delivery channel, not the chip: the count is decided
 * during the context fetch, which is far too late for a response header
 * (toDataStreamResponse builds those synchronously, before doStream resolves).
 * It rides a StreamData message annotation instead — the same channel the
 * failover chip uses. This asserts that an annotation appended BEFORE the model
 * starts still reaches the wire, and that the client reader picks it up.
 *
 * Run: npx tsx scripts/verify-web-search-marker.ts   (no API keys needed)
 */
import { streamText, StreamData } from 'ai';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import type { Message } from 'ai';
import { readWebSearchAnnotation } from '../lib/chat/annotations';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
}

function mockModel() {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta' as const, textDelta: 'Rates held steady.' },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { promptTokens: 1, completionTokens: 3 } },
        ],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

(async () => {
  // ── The annotation survives being written before the model starts ──────────
  console.log('\ndelivery channel:');

  const data = new StreamData();
  data.appendMessageAnnotation({ modusWebSearch: 5 });
  const result = streamText({
    model: mockModel(),
    prompt: 'what is the latest news on rates',
    onFinish: async () => { await data.close(); },
  });
  const body = await result.toDataStreamResponse({ data }).text();

  const annotationLine = body.split('\n').find(l => l.startsWith('8:'));
  console.log(`        annotation part: ${annotationLine ? JSON.stringify(annotationLine) : '(none)'}`);
  check('a message_annotations (8:) part reaches the wire', !!annotationLine);
  check('it carries the result count', !!annotationLine && annotationLine.includes('"modusWebSearch":5'));
  check('the answer text still streams normally', body.includes('Rates held steady.'));

  // A turn with no search must stay completely clean — no empty chip, no noise.
  const quiet = new StreamData();
  const quietResult = streamText({
    model: mockModel(),
    prompt: 'hi',
    onFinish: async () => { await quiet.close(); },
  });
  const quietBody = await quietResult.toDataStreamResponse({ data: quiet }).text();
  check('no search → no annotation part at all', !quietBody.split('\n').some(l => l.startsWith('8:')));

  // ── The client reader ──────────────────────────────────────────────────────
  console.log('\nclient reader:');
  const msg = (annotations?: unknown[]): Message =>
    ({ id: 'x', role: 'assistant', content: 'hi', ...(annotations ? { annotations } : {}) }) as Message;

  check('reads the count', readWebSearchAnnotation(msg([{ modusWebSearch: 5 }])) === 5);
  check('no annotations → 0', readWebSearchAnnotation(msg()) === 0);
  check('unrelated annotations → 0', readWebSearchAnnotation(msg([{ modusServedModel: 'gpt-5.6-terra' }])) === 0);
  check('finds it alongside the failover annotation',
    readWebSearchAnnotation(msg([{ modusServedModel: 'gpt-5.6-terra' }, { modusWebSearch: 3 }])) === 3);
  check('a zero count never renders a chip', readWebSearchAnnotation(msg([{ modusWebSearch: 0 }])) === 0);
  check('a malformed count is ignored', readWebSearchAnnotation(msg([{ modusWebSearch: 'lots' }])) === 0);
  check('null annotations do not throw', readWebSearchAnnotation(msg([null, { modusWebSearch: 2 }])) === 2);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
