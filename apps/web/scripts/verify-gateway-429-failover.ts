/**
 * Regression test for the 2026-07-22 outage: a textbook 429 that failover missed.
 *
 * The user sent a message, Llama 3.3 was rate-limited by the Vercel AI Gateway's
 * free tier, and MODUS answered NOTHING — no fallback was attempted, even though
 * a fallback chain was wired up precisely for this.
 *
 * Why it slipped through: isFailoverError matched on prose. The Gateway writes
 * "...are rate-limited" (hyphenated), which does not contain "rate limit", and
 * the AI SDK wraps it in an AI_RetryError whose own message is only "Failed
 * after 3 attempts. Last error: ...". The 429 exists ONLY as a number on
 * .lastError.statusCode / .errors[].statusCode — never in the string.
 *
 * The provider is mocked; the failover logic is the REAL createFallbackModel /
 * isFailoverError from lib/chat/model.ts, driven through the REAL streamText.
 * The thrown error is reconstructed from the Vercel runtime log captured at
 * 2026-07-22T10:32:02Z (project prj_h0hIKrz…, route /api/chat).
 *
 * Run: npx tsx scripts/verify-gateway-429-failover.ts
 */
import { streamText } from 'ai';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { createFallbackModel } from '../lib/chat/model';

type LM = Parameters<typeof createFallbackModel>[0][number];

/** The VERBATIM Gateway free-tier rejection, as an AI_APICallError carries it. */
function gatewayRateLimitError(): Error {
  const inner = new Error(
    'Free tier requests on this model are rate-limited. Upgrade to paid credits at ' +
      'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up for unrestricted access.'
  ) as Error & { statusCode?: number; isRetryable?: boolean };
  inner.name = 'AI_APICallError';
  inner.statusCode = 429;
  inner.isRetryable = true;
  return inner;
}

/** …as the AI SDK re-throws it after exhausting its own retries. */
function aiRetryError(): Error {
  const inner = gatewayRateLimitError();
  const retry = new Error(
    'Failed after 3 attempts. Last error: Free tier requests on this model are rate-limited. ' +
      'Upgrade to paid credits at https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up ' +
      'for unrestricted access.'
  ) as Error & { reason?: string; errors?: unknown[]; lastError?: unknown };
  retry.name = 'AI_RetryError';
  retry.reason = 'maxRetriesExceeded';
  retry.errors = [inner, inner, inner];
  retry.lastError = inner;
  return retry;
}

/** A permanent config error — failing over on this would burn the whole chain. */
function authError(): Error {
  const e = new Error('Incorrect API key provided.') as Error & { statusCode?: number };
  e.name = 'AI_APICallError';
  e.statusCode = 401;
  return e;
}

function failing(modelId: string, err: Error): LM {
  return new MockLanguageModelV1({
    provider: 'mock',
    modelId,
    doStream: async () => { throw err; },
  }) as unknown as LM;
}

function answering(modelId: string, text: string): LM {
  return new MockLanguageModelV1({
    provider: 'mock',
    modelId,
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta' as const, textDelta: text },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { promptTokens: 1, completionTokens: 1 } },
        ],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LM;
}

let failures = 0;
function check(label: string, pass: boolean, detail: string) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}\n      ${detail}`);
  if (!pass) failures++;
}

/** Drive the real chain and report what actually answered. */
async function run(primaryError: Error): Promise<{ text: string; served: string; switches: string[] }> {
  const switches: string[] = [];
  let served = 'llama-primary';
  const model = createFallbackModel(
    [failing('llama-primary', primaryError), answering('fallback-model', 'Hey! What can I do for you?')],
    { onFallback: (from, to) => switches.push(`${from}->${to}`), onServed: (id) => { served = id; } },
  );
  const result = streamText({ model, prompt: 'yo' });
  let text = '';
  try {
    for await (const delta of result.textStream) text += delta;
  } catch (e) {
    text = `__THREW__ ${String(e).slice(0, 60)}`;
  }
  return { text, served, switches };
}

async function main() {
  // ── 1. The exact production failure ────────────────────────────────────────
  const retry = await run(aiRetryError());
  check(
    'AI_RetryError wrapping the Gateway free-tier 429 fails over',
    retry.served === 'fallback-model' && retry.text.includes('Hey!'),
    `served=${retry.served} switches=[${retry.switches.join(', ')}] text=${JSON.stringify(retry.text.slice(0, 40))}`,
  );

  // ── 2. The unwrapped form, in case the SDK stops wrapping ───────────────────
  const bare = await run(gatewayRateLimitError());
  check(
    'a bare 429 AI_APICallError fails over',
    bare.served === 'fallback-model',
    `served=${bare.served} switches=[${bare.switches.join(', ')}]`,
  );

  // ── 3. The string arm alone must still work (no statusCode present) ─────────
  const stringOnly = new Error('Free tier requests on this model are rate-limited.');
  const hyphen = await run(stringOnly);
  check(
    'hyphenated "rate-limited" with NO status code still fails over',
    hyphen.served === 'fallback-model',
    `the original miss: "rate-limited" does not contain "rate limit" -> served=${hyphen.served}`,
  );

  // ── 4. The guard: permanent errors must NOT walk the chain ──────────────────
  // The invariant is that the chain is NOT walked. streamText ends the
  // textStream on a terminal error rather than throwing through it, so assert on
  // the switch log and the served id — not on how the error surfaced.
  const auth = await run(authError());
  check(
    'a 401 auth error does NOT fail over (it would fail on every model)',
    auth.switches.length === 0 && auth.served === 'llama-primary' && !auth.text.includes('Hey!'),
    `switches=[${auth.switches.join(', ')}] served=${auth.served} fallbackAnswered=${auth.text.includes('Hey!')}`,
  );

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
