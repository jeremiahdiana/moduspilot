/**
 * Walk the WHOLE catalog and assert no listed model is sent parameters its
 * provider rejects.
 *
 * 🪤 `claude-opus-4-8` returned 0 characters on every message from the day it was
 * listed, because the temperature guard was `/^claude-.*-5$/` — true of
 * sonnet-5 and fable-5, false of opus. Measured on prod 2026-07-23:
 *   AI_APICallError: `temperature` is deprecated for this model.
 * The reasoning-budget test had the same shape, so opus also got the 2048 cap
 * that exists to stop thinking models returning blank bubbles.
 *
 * A catalog entry is a PROMISE that the model answers. This walks every entry, so
 * the next model added cannot quietly miss a constraint the way opus did.
 *
 *   cd apps/web && npx tsx scripts/verify-model-params.ts
 */
import { PLATFORM_MODELS } from '../lib/models';
import { needsExplicitTemperature, isReasoningModel, maxTokensFor } from '../lib/chat/model-params';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
}

console.log(`\n── every catalog model (${PLATFORM_MODELS.length}) ──`);
for (const m of PLATFORM_MODELS) {
  const temp = needsExplicitTemperature(m.id);
  const cap = maxTokensFor(m.id);
  console.log(`   ${m.id.padEnd(24)} provider=${m.provider.padEnd(10)} temperature=${temp ? '1' : 'default'}  maxTokens=${cap}`);
}

console.log('\n── Anthropic: every one must send an explicit temperature ──');
for (const m of PLATFORM_MODELS.filter(x => x.provider === 'Anthropic')) {
  check(
    `${m.id} sends temperature:1 (omitting it is a hard 400 on this SDK)`,
    needsExplicitTemperature(m.id),
  );
}
// The regression that started this: opus must not be excluded by its version suffix.
check('claude-opus-4-8 specifically — the model the `-5$` rule missed', needsExplicitTemperature('claude-opus-4-8'));

console.log('\n── thinking models must not get the 2048 cap ──');
for (const m of PLATFORM_MODELS.filter(x => ['Anthropic', 'OpenAI', 'Google'].includes(x.provider))) {
  check(`${m.id} gets reasoning headroom (16000)`, maxTokensFor(m.id) === 16000, maxTokensFor(m.id));
}

console.log('\n── non-reasoning models keep the cheap cap ──');
check('meta/llama-3.3-70b stays at 2048', maxTokensFor('meta/llama-3.3-70b') === 2048, maxTokensFor('meta/llama-3.3-70b'));
check('deepseek/deepseek-v3.1 stays at 2048', maxTokensFor('deepseek/deepseek-v3.1') === 2048, maxTokensFor('deepseek/deepseek-v3.1'));
check('a Meta model is not treated as reasoning', !isReasoningModel('meta/llama-4-maverick'));

console.log('\n── future-proofing: a new version suffix must not slip through ──');
check('a hypothetical claude-opus-5-2 still gets temperature', needsExplicitTemperature('claude-opus-5-2'));
check('a hypothetical claude-haiku-6 still gets headroom', maxTokensFor('claude-haiku-6') === 16000);

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
