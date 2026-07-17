/**
 * Does the Anthropic prompt-cache breakpoint SURVIVE to the wire in production?
 *
 * app/api/chat/route.ts builds a two-system-message prompt whose stable prefix
 * carries providerOptions.anthropic.cacheControl. Its own comment warns that the
 * AI SDK's UI-message path drops providerOptions — but that warning is only a
 * console.log, it does not change what gets sent. So the cache could be silently
 * off in prod and nothing would say so.
 *
 * This does NOT trust the log, the docs, or the minified source: it intercepts the
 * real outgoing HTTP request via a custom fetch and reads the JSON body Anthropic
 * would have received. `cache_control` present = the cache fires. Absent = we pay
 * full price for the ~5.6k prefix on every message.
 *
 * No API key and no network are needed — the body is built before fetch is called,
 * so the interceptor captures it and aborts.
 *
 * Run: npx tsx scripts/verify-anthropic-cache.ts
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToCoreMessages, type CoreMessage } from 'ai';

const STABLE = 'STABLE_PREFIX_'.repeat(20);
const TAIL = 'VOLATILE_TAIL';

let captured: unknown = null;

const capturingFetch: typeof fetch = async (_url, init) => {
  captured = JSON.parse(String((init as RequestInit).body));
  throw new Error('__CAPTURED__');
};

const anthropic = createAnthropic({ apiKey: 'sk-ant-fake-not-used', fetch: capturingFetch });

/** Exactly what route.ts builds. */
function cachedSystemMessages(): CoreMessage[] {
  return [
    { role: 'system', content: STABLE, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
    { role: 'system', content: TAIL },
  ];
}

const bodies: Record<string, unknown> = {};

async function attempt(label: string, messages: unknown[], key?: string) {
  captured = null;
  try {
    const r = streamText({
      model: anthropic('claude-sonnet-5'),
      messages: [...cachedSystemMessages(), ...messages] as CoreMessage[],
      maxTokens: 16,
      temperature: 1,
    });
    // force the request to actually be issued
    for await (const _ of r.textStream) { /* drained */ }
  } catch {
    /* __CAPTURED__ or downstream error — the body is what we want */
  }

  if (!captured) {
    console.log(`${label}\n   ⚠️  no request captured — could not evaluate\n`);
    return;
  }
  if (key) bodies[key] = captured;
  const body = captured as { system?: Array<{ text: string; cache_control?: unknown }> };
  const sys = body.system;
  const hasBreakpoint = Array.isArray(sys) && sys.some(s => s.cache_control != null);
  console.log(`${label}`);
  console.log(`   system blocks: ${Array.isArray(sys) ? sys.length : `not an array (${typeof sys})`}`);
  if (Array.isArray(sys)) {
    sys.forEach((s, i) =>
      console.log(`     [${i}] ${JSON.stringify(s.text).slice(0, 34)}… cache_control=${JSON.stringify(s.cache_control)}`),
    );
  }
  console.log(`   ${hasBreakpoint ? '✅ CACHE FIRES' : '❌ NO cache_control — full price every message'}\n`);
}

/** Exactly what useChat posts: fillMessageParts() guarantees `parts` on every message. */
const UI_MESSAGES = [{ role: 'user' as const, content: 'hi', parts: [{ type: 'text' as const, text: 'hi' }] }];

(async () => {
  // A: plain CoreMessages — what the code ASSUMES it is sending.
  await attempt('A) plain CoreMessage user turn (the assumption):', [{ role: 'user', content: 'hi' }]);

  // B: what actually ships. route.ts's uiShaped check spots exactly this — but only logs.
  await attempt('B) UI-shaped user turn — THE PRODUCTION SHAPE:', UI_MESSAGES, 'prod');

  // C: the candidate fix — normalise the CLIENT messages to CoreMessages first, so the
  // array handed to streamText is uniformly Core and never takes the UI path that
  // rebuilds (and strips) our system messages.
  await attempt('C) FIX — convertToCoreMessages(clientMessages) first:', convertToCoreMessages(UI_MESSAGES), 'fixed');

  // Is the fix behaviour-NEUTRAL? streamText already converts UI→Core internally, so
  // doing it ourselves should change the wire format in exactly ONE way: cache_control.
  // Anything else differing would mean the fix alters what the model actually receives.
  const strip = (b: unknown) =>
    JSON.parse(JSON.stringify(b), (k, v) => (k === 'cache_control' ? undefined : v));
  const same = JSON.stringify(strip(bodies.prod)) === JSON.stringify(strip(bodies.fixed));
  console.log('── Is the fix behaviour-neutral? (bodies compared ignoring cache_control)');
  console.log(
    same
      ? '   ✅ IDENTICAL apart from cache_control — the model receives exactly what it does today.'
      : '   ❌ THE FIX CHANGES THE PAYLOAD — investigate before shipping:\n' +
        `   prod : ${JSON.stringify(strip(bodies.prod)).slice(0, 220)}\n` +
        `   fixed: ${JSON.stringify(strip(bodies.fixed)).slice(0, 220)}`,
  );

  // Fail loudly: a green run must mean the breakpoint is on the wire, not that
  // the script ran. The route's own uiShaped detector was correct and inert —
  // this file exists so the fix is asserted rather than described.
  const fires = (b: unknown) =>
    ((b as { system?: Array<{ cache_control?: unknown }> })?.system ?? []).some(s => s.cache_control != null);
  const failures = [
    !fires(bodies.fixed) && 'convertToCoreMessages did NOT restore cache_control — the cache is off',
    fires(bodies.prod) && 'the raw UI shape now caches — this script no longer reproduces the bug it guards',
    !same && 'the fix altered the payload beyond cache_control',
  ].filter(Boolean);

  if (failures.length > 0) {
    console.error(`\n❌ FAILED:\n   - ${failures.join('\n   - ')}`);
    process.exit(1);
  }
  console.log('\n✅ 3/3 — breakpoint reaches the wire, and only cache_control changed.');
})();
