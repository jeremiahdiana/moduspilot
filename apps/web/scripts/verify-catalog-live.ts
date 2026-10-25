/**
 * Every catalog model answers through MODUS's REAL request shape: the resolved
 * provider, a system prompt, the route's caps, each effort level, and a tool call
 * where the model takes tools. Costs a few cents.
 *
 * 🚨 WHY THIS EXISTS. The 2026-10-25 generation swap passed every offline verifier
 * and was still broken three ways on the wire, each found only by a live call:
 *   · GPT-6 400'd on `max_tokens` (the pinned SDK only rewrites gpt-5 ids)
 *   · every Claude 400'd at Low/High effort (`thinking: enabled` is rejected)
 *   · every Gemini 400'd on step two of a tool call (missing thought_signature)
 * The last two were ALREADY live in prod on the old models. A unit test proves
 * what we send; only this proves the provider accepts it.
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && npx tsx scripts/verify-catalog-live.ts
 */
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { PLATFORM_MODELS } from '../lib/models';
import { resolveChatModel, modelSupportsTools } from '../lib/chat/model';
import { maxTokensFor, needsExplicitTemperature } from '../lib/chat/model-params';
import { effortProviderOptions, supportsEffort, EFFORT_LEVELS } from '../lib/chat/effort';

// ai@4's stream promises can leave no pending handle, and Node then exits 0
// mid-run with nothing printed. Hold the loop open until we finish.
const keep = setInterval(() => {}, 1000);
let failures = 0;

async function run(id: string, effort: (typeof EFFORT_LEVELS)[number], withTools: boolean) {
  const r = resolveChatModel({ plan: 'pilot', settings: { modelSettings: { provider: 'platform', model: id } } }, {});
  const tools = withTools
    ? { get_weather: tool({ description: 'Get the weather for a city', parameters: z.object({ city: z.string() }), execute: async () => ({ tempC: 21, sky: 'clear' }) }) }
    : undefined;
  const label = `${id.padEnd(24)} ${effort.padEnd(6)} ${withTools ? 'tools' : 'plain'}`;
  let error = '';
  try {
    const res = streamText({
      model: r.model,
      system: 'You are MODUS. Use tools when relevant. Answer in one short sentence.',
      messages: [{ role: 'user', content: withTools ? 'What is the weather in Paris right now?' : 'What is 17 times 3?' }],
      maxTokens: maxTokensFor(id),
      ...(needsExplicitTemperature(id) ? { temperature: 1 } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      providerOptions: effortProviderOptions(id, effort) as any,
      tools,
      maxSteps: 3,
      onError: (e) => { error = String((e as { error?: { message?: string } })?.error?.message ?? e); },
    });
    let text = '';
    let calls = 0;
    for await (const p of res.fullStream) {
      if (p.type === 'text-delta') text += p.textDelta;
      if (p.type === 'tool-call') calls++;
    }
    const ok = !error && r.modelId === id && text.trim().length > 0 && (!withTools || calls > 0);
    if (!ok) failures++;
    console.log(`${ok ? '✅' : '❌'} ${label} served=${r.modelId} calls=${calls} ${error ? `ERROR ${error.slice(0, 140)}` : JSON.stringify(text.trim().slice(0, 50))}`);
  } catch (e) {
    failures++;
    console.log(`❌ ${label} threw ${String((e as Error)?.message ?? e).slice(0, 160)}`);
  }
}

(async () => {
  for (const m of PLATFORM_MODELS) {
    const levels = supportsEffort(m.id) ? EFFORT_LEVELS : (['medium'] as const);
    for (const effort of levels) await run(m.id, effort, false);
    if (modelSupportsTools(m.id)) await run(m.id, supportsEffort(m.id) ? 'high' : 'medium', true);
  }
  console.log(failures ? `\n❌ ${failures} failed` : '\n✅ every catalog model answers at every effort, and calls tools where it takes them');
  clearInterval(keep);
  process.exit(failures ? 1 : 0);
})();
