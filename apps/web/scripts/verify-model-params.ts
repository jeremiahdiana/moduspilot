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
import { modelSupportsTools, rewriteNewGenOpenAIBody, rewriteClaudeThinkingBody, rewriteGeminiSignatureBody } from '../lib/chat/model';

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
check('a hypothetical gpt-7 still gets headroom', maxTokensFor('gpt-7-sol') === 16000);
check('a hypothetical gemini-5 still gets headroom', maxTokensFor('gemini-5-pro') === 16000);

// OpenAI's GPT reasoning family hard 400s on function tools over
// /v1/chat/completions. Verified live 2026-10-25 for gpt-6.1-sol and gpt-6-astra:
// "Function tools with reasoning_effort are not supported ... set reasoning_effort
// to 'none'". This gate was `/^gpt-5/` until that day and GPT-6 would have slipped it.
console.log('\n── OpenAI GPT reasoning models must not be sent function tools ──');
for (const m of PLATFORM_MODELS.filter(m => /^gpt-/.test(m.id))) {
  check(`${m.id} gets no function tools`, !modelSupportsTools(m.id));
}
check('a hypothetical gpt-7 gets no function tools', !modelSupportsTools('gpt-7-sol'));
check('claude-sonnet-5-5 keeps its tools', modelSupportsTools('claude-sonnet-5-5'));

// The three wire rewrites in lib/chat/model.ts. Each one was a live 400 on
// 2026-10-25. scripts/verify-catalog-live.ts proves the provider accepts the
// result; these pin the shape offline.
console.log('\n── wire rewrites for the pinned SDKs ──');
{
  const o = rewriteNewGenOpenAIBody({ model: 'gpt-6.1-sol', max_tokens: 16000, temperature: 0, messages: [{ role: 'system', content: 's' }] });
  check('gpt-6 max_tokens becomes max_completion_tokens', o.max_completion_tokens === 16000 && o.max_tokens === undefined, o);
  check('gpt-6 loses temperature', o.temperature === undefined, o);
  check('gpt-6 system prompt is sent as developer', (o.messages as Array<{ role: string }>)[0].role === 'developer', o);
  const five = { model: 'gpt-5.6-sol', max_tokens: 10 };
  check('gpt-5 bodies pass through (the SDK already handles them)', rewriteNewGenOpenAIBody(five) === five);
  const mini = { model: 'gpt-4o-mini', max_tokens: 10 };
  check('gpt-4o-mini passes through', rewriteNewGenOpenAIBody(mini) === mini);

  const c = rewriteClaudeThinkingBody({ model: 'claude-opus-5-5', thinking: { type: 'enabled', budget_tokens: 8000 } });
  check('claude high → adaptive + effort high', (c.thinking as { type: string }).type === 'adaptive' && (c.output_config as { effort: string }).effort === 'high', c);
  const cl = rewriteClaudeThinkingBody({ model: 'claude-sonnet-5-5', thinking: { type: 'enabled', budget_tokens: 2048 } });
  check('claude low → effort low', (cl.output_config as { effort: string }).effort === 'low', cl);
  const haiku = { model: 'claude-haiku-4-5-20251001', thinking: { type: 'enabled', budget_tokens: 2048 } };
  check('haiku 4.5 keeps budget thinking (it rejects adaptive)', rewriteClaudeThinkingBody(haiku) === haiku);
  const plain = { model: 'claude-fable-5-1' };
  check('claude with no thinking passes through', rewriteClaudeThinkingBody(plain) === plain);

  const g = rewriteGeminiSignatureBody({ contents: [{ role: 'model', parts: [{ functionCall: { name: 'x', args: {} } }] }] });
  const part = (g.contents as Array<{ parts: Array<{ thoughtSignature?: string }> }>)[0].parts[0];
  check('gemini functionCall without a signature gets the skip sentinel', part.thoughtSignature === 'skip_thought_signature_validator', g);
  const signed = { contents: [{ role: 'model', parts: [{ functionCall: { name: 'x' }, thoughtSignature: 'real' }] }] };
  check('a real gemini signature is left alone', rewriteGeminiSignatureBody(signed) === signed);
}

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
