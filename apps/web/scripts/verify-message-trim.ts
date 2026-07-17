/**
 * Proves the history/size-guard trims actually reach the model.
 *
 * They did not. route.ts trimmed `content`, but useChat sends `parts` and
 * convertToCoreMessages reads text from `parts` and ignores `content` when it is
 * present (ai/dist/index.mjs:1750) — so every trim was dead code. Measured before
 * the fix: an 8,000-char cap delivered 50,000 chars.
 *
 * EVERYTHING HERE IS REAL except the HTTP transport: the real convertToCoreMessages
 * (the route's boundary normalisation), the real trimMessageText/messageTextLength
 * from lib/chat/messages, the real streamText. A custom `fetch` captures the body
 * the provider WOULD have received — the request is built before fetch is called,
 * so this needs no API key and no network.
 *
 * Run: npx tsx scripts/verify-message-trim.ts
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToCoreMessages, type CoreMessage } from 'ai';
import { messageTextLength, trimMessageText } from '../lib/chat/messages';

type WirePart = { type: string; text?: string };
type WireBody = { messages?: Array<{ content: WirePart[] }> };

let captured: WireBody | null = null;
const capturingFetch: typeof fetch = async (_url, init) => {
  captured = JSON.parse(String((init as RequestInit).body)) as WireBody;
  throw new Error('__CAPTURED__');
};
// Read through a function: the assignment happens inside a closure TS can't see,
// so a direct read gets narrowed to `null` and the body becomes unreachable.
const readCaptured = (): WireBody | null => captured;

const anthropic = createAnthropic({ apiKey: 'sk-ant-fake-not-used', fetch: capturingFetch });

/** Text actually delivered to the provider, read off the wire. */
async function wireText(messages: CoreMessage[]): Promise<{ chars: number; imageParts: number }> {
  captured = null;
  try {
    const r = streamText({ model: anthropic('claude-sonnet-5'), messages, maxTokens: 8, temperature: 1 });
    for await (const _ of r.textStream) { /* drain */ }
  } catch { /* captured */ }
  const parts: WirePart[] = (readCaptured()?.messages ?? []).flatMap(m => (Array.isArray(m.content) ? m.content : []));
  return {
    chars: parts.reduce((n, p) => n + (p.type === 'text' ? (p.text ?? '').length : 0), 0),
    imageParts: parts.filter(p => p.type === 'image').length,
  };
}

const FULL = 'X'.repeat(50_000);
const CAP = 8_000;
const fails: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) fails.push(label);
};

(async () => {
  // Exactly what useChat posts: `parts` carries the text, `content` mirrors it.
  const uiMessages = [{ role: 'user' as const, content: FULL, parts: [{ type: 'text' as const, text: FULL }] }];

  console.log('1) The old idiom (trim `content`, leave `parts`) — the bug this replaces:');
  const oldWay = [{ ...uiMessages[0], content: FULL.slice(0, CAP) }];
  const before = await wireText(oldWay as unknown as CoreMessage[]);
  check(before.chars === 50_000, `dead trim still delivers the full ${before.chars.toLocaleString()} chars (reproduces the bug)`);

  console.log('\n2) The route\'s flow — normalise at the boundary, THEN trim:');
  const core = convertToCoreMessages(uiMessages as Parameters<typeof convertToCoreMessages>[0]);
  const trimmed = core.map(m => trimMessageText(m, CAP));
  const after = await wireText(trimmed);
  check(after.chars === CAP, `cap ${CAP.toLocaleString()} delivers exactly ${after.chars.toLocaleString()} chars`);
  check(messageTextLength(trimmed[0]) === CAP, 'messageTextLength agrees with the wire (budget accounting is honest)');

  console.log('\n3) Attachments survive a trim (dropping an image would break vision):');
  const withImage: CoreMessage[] = [{
    role: 'user',
    content: [
      { type: 'text', text: FULL },
      { type: 'image', image: 'https://example.com/x.png' },
    ],
  }];
  const img = await wireText(withImage.map(m => trimMessageText(m, CAP)));
  check(img.chars === CAP, `text trimmed to ${img.chars.toLocaleString()}`);
  check(img.imageParts === 1, 'image part still on the wire');

  console.log('\n4) Under-cap messages are untouched (no needless copying):');
  const small: CoreMessage[] = [{ role: 'user', content: 'hello' }];
  check(trimMessageText(small[0], CAP) === small[0], 'returns the same object when nothing to trim');

  if (fails.length > 0) {
    console.error(`\n❌ ${fails.length} FAILED:\n   - ${fails.join('\n   - ')}`);
    process.exit(1);
  }
  console.log('\n✅ 6/6 — the cap is real, the accounting matches the wire, attachments survive.');
})();
