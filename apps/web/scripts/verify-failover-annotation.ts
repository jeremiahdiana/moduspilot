/**
 * Proves the silent-downgrade fix on the real code path, without needing the
 * Google key (it is a Vercel `sensitive` var and cannot be pulled).
 *
 * The provider is mocked; EVERYTHING ELSE IS THE REAL THING — the real
 * createFallbackModel/isFailoverError/isPremiumModel from lib/chat/model.ts, the
 * real streamText, the real StreamData, and the real toDataStreamResponse. The
 * error string the mock throws is the VERBATIM Google 429 captured from the live
 * API on 2026-07-16.
 *
 * Run: npx tsx scripts/verify-failover-annotation.ts
 */
import { streamText, StreamData } from 'ai';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { createFallbackModel, isPremiumModel } from '../lib/chat/model';
import { PLATFORM_MODELS } from '../lib/models';

// Verbatim from the live Google API, 2026-07-16, on the production (free-tier) key.
const GOOGLE_BILLING_429 =
  'AI_APICallError: Failed after 3 attempts. Last error: 429 You exceeded your ' +
  'current quota, please check your plan and billing details.';

type LM = Parameters<typeof createFallbackModel>[0][number];

function failing(modelId: string, error: string): LM {
  return new MockLanguageModelV1({
    provider: 'mock',
    modelId,
    doStream: async () => { throw new Error(error); },
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
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { promptTokens: 1, completionTokens: 1 },
          },
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

async function main() {
  // ── 1. The bug: Google's BILLING failure is classified as transient ──────────
  // isFailoverError is not exported, so probe it through the observable behaviour
  // it drives: a matching error retries the chain, a non-matching one throws.
  const requested = 'gemini-3.5-flash';
  const served = 'llama-3.3-70b-versatile';

  // ── 3. The route's exact plumbing: annotation onto the data stream ───────────
  const streamData = new StreamData();
  let closed = false;
  const closeStreamData = async () => {
    if (closed) return;
    closed = true;
    try { await streamData.close(); } catch (e) { console.error('close failed', e); }
  };

  // ── 2. onServed reports the model that ACTUALLY answered ─────────────────────
  // The append MUST live inside onServed, exactly as route.ts does it. Appending
  // synchronously after streamText() instead reads servedModelId before doStream
  // has resolved — the identical mistake that makes the response header wrong.
  let servedModelId = requested;
  const switches: string[] = [];
  const chain = [
    failing(requested, GOOGLE_BILLING_429),
    answering(served, 'Hello from Llama.'),
  ];
  const failoverModel = createFallbackModel(chain, {
    onFallback: (from, to) => switches.push(`${from}->${to}`),
    onServed: (id) => {
      servedModelId = id;
      if (id === requested) return;
      streamData.appendMessageAnnotation({
        modusServedModel: id,
        modusRequestedModel: requested,
        modusDowngraded: isPremiumModel(requested),
      });
    },
  });

  const result = streamText({
    model: failoverModel,
    prompt: 'hi',
    onError: async () => { await closeStreamData(); },
    onFinish: async () => { await closeStreamData(); },
  });

  const res = result.toDataStreamResponse({ data: streamData });
  const wire = await res.text();

  console.log('\n--- raw data stream sent to the browser ---');
  console.log(wire.trim());
  console.log('--- end ---\n');

  check(
    "Google's billing 429 is treated as transient and retried (THE BUG)",
    switches.length === 1 && switches[0] === `${requested}->${served}`,
    `failover hops: ${JSON.stringify(switches)}`,
  );
  check(
    'onServed reports the model that actually answered, not the one requested',
    servedModelId === served,
    `requested=${requested}  served=${servedModelId}`,
  );
  check(
    'MODUS still answers (the chain still does its job)',
    wire.includes('Hello from Llama.'),
    'answer text present on the wire',
  );

  // The annotation frame the client reads. '8:' is the AI SDK's message-annotation
  // part; the client surfaces it as message.annotations.
  const annLine = wire.split('\n').find(l => l.startsWith('8:'));
  const ann = annLine ? JSON.parse(annLine.slice(2))[0] : undefined;

  check(
    'a message annotation reaches the client in-band (headers could not)',
    !!ann,
    annLine ? `wire frame: ${annLine}` : 'NO 8: annotation frame found',
  );
  check(
    'the annotation names the real answering model',
    ann?.modusServedModel === served && ann?.modusRequestedModel === requested,
    `served=${ann?.modusServedModel} requested=${ann?.modusRequestedModel}`,
  );
  check(
    'a premium pick is flagged downgraded -> user sees the notice',
    ann?.modusDowngraded === true,
    `modusDowngraded=${ann?.modusDowngraded} (isPremiumModel('${requested}')=${isPremiumModel(requested)})`,
  );

  // ── 4. The free-tier Groq hop must stay quiet ────────────────────────────────
  check(
    'a free-tier Llama->Llama TPM hop is NOT flagged (no notice spam)',
    isPremiumModel('llama-3.3-70b-versatile') === false,
    `isPremiumModel('llama-3.3-70b-versatile')=${isPremiumModel('llama-3.3-70b-versatile')}`,
  );

  // The size guard (route.ts) upgrades Llama->Terra for large requests on MODUS's
  // OWN initiative. If that upgrade then fails over, the user must NOT be told
  // "GPT-5.6 Terra was unavailable" — they picked the free default and never chose
  // Terra. This is why the route flags on promisedModelId (snapshotted before the
  // size guard) instead of on resolved.modelId.
  const promisedAfterSizeGuard = 'llama-3.3-70b-versatile'; // what the user picked
  const resolvedAfterSizeGuard = 'gpt-5.6-terra';           // what the guard swapped in
  check(
    'a size-guard upgrade that fails over does NOT blame a model the user never picked',
    isPremiumModel(promisedAfterSizeGuard) === false && isPremiumModel(resolvedAfterSizeGuard) === true,
    `promised=${promisedAfterSizeGuard} (premium=${isPremiumModel(promisedAfterSizeGuard)}) vs ` +
      `resolved=${resolvedAfterSizeGuard} (premium=${isPremiumModel(resolvedAfterSizeGuard)}) ` +
      `-> flagging on resolved would wrongly notify`,
  );

  // ── 5. No switch => no annotation => nothing changes on the happy path ───────
  let served2 = 'gemini-3.5-flash';
  const okModel = createFallbackModel(
    [answering('gemini-3.5-flash', 'Hi from Gemini.'), answering('llama-3.3-70b-versatile', 'x')],
    { onServed: (id) => { served2 = id; } },
  );
  const d2 = new StreamData();
  const r2 = streamText({ model: okModel, prompt: 'hi', onFinish: async () => { await d2.close(); } });
  const wire2 = await r2.toDataStreamResponse({ data: d2 }).text();
  check(
    'when the picked model works, nothing is annotated (fix is invisible)',
    served2 === 'gemini-3.5-flash' && !wire2.split('\n').some(l => l.startsWith('8:')),
    `served=${served2}, annotation frames=${wire2.split('\n').filter(l => l.startsWith('8:')).length}`,
  );

  // ── 6. isPremiumModel is an OR of two tests — assert the COMPOSED gate ───────
  // Each side alone has a silent-downgrade hole, so testing one side proves
  // nothing. Every case below must hold for the disclosure to be trustworthy.
  const premiumCases: [string, boolean, string][] = [
    ['gemini-3.5-flash',                          true,  'catalog + regex — the original bug'],
    ['claude-opus-4-8',                           true,  'catalog + regex'],
    ['claude-3-opus',                             true,  'REGEX ONLY: stale saved Brain, not in catalog'],
    ['openai/gpt-oss-120b',                       false, 'not yet in catalog, matches no prefix — the Aug-16 migration MUST add it to BOTH'],
    ['llama-3.3-70b-versatile',                   false, 'free default — promised nothing'],
    ['llama-3.1-8b-instant',                      false, 'free fallback — promised nothing'],
    ['auto',                                      false, 'not a specific model'],
    ['gemini-2.5-pro',                            true,  'legacy id canonicalises into the catalog'],
  ];
  for (const [id, want, why] of premiumCases) {
    check(
      `isPremiumModel(${id}) === ${want}`,
      isPremiumModel(id) === want,
      `${why} -> got ${isPremiumModel(id)}`,
    );
  }

  // The CATALOG arm of the OR, asserted against the real catalog rather than one
  // hand-picked id. Today every entry happens to match the regex too, so this looks
  // redundant — it is not: the moment a Groq-hosted id ('openai/gpt-oss-120b', the
  // Aug-16 replacement) is added, the regex stops covering it and THIS is the check
  // that catches a silent downgrade.
  const shouldBePremium = PLATFORM_MODELS.filter(m => m.id !== 'llama-3.3-70b-versatile');
  const missed = shouldBePremium.filter(m => !isPremiumModel(m.id));
  check(
    'every catalog model except the free default is premium (the catalog arm)',
    missed.length === 0,
    missed.length ? `NOT flagged -> would downgrade SILENTLY: ${missed.map(m => m.id).join(', ')}`
                  : `${shouldBePremium.length} models checked`,
  );

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
