/**
 * Walk the catalog x every effort level and assert the options we would send are
 * ones the provider actually accepts.
 *
 * The failure this guards against is the expensive one: an effort setting that
 * produces a blank bubble, or a thinking budget that collides with maxTokens. Both
 * return HTTP 200, so neither shows up as an error anywhere.
 *
 * ⚠️ This is STRUCTURAL, like verify-model-params.ts. It proves we send a legal
 * shape, not that the model answers. The live check is scripts/smoke-prod-chat.ts
 * after a deploy, with the account's reasoningEffort set to low and then high.
 *
 *   cd apps/web && npx tsx scripts/verify-effort.ts
 */
import { PLATFORM_MODELS } from '../lib/models';
import { maxTokensFor, isReasoningModel } from '../lib/chat/model-params';
import { EFFORT_LEVELS, DEFAULT_EFFORT, effortProviderOptions, supportsEffort, effortFor } from '../lib/chat/effort';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) { failures++; console.log(`❌ ${label}`); if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
  return cond;
}

console.log(`\n── effort options, ${PLATFORM_MODELS.length} models x ${EFFORT_LEVELS.length} levels ──\n`);

for (const m of PLATFORM_MODELS) {
  const cap = maxTokensFor(m.id);
  const cells: string[] = [];

  for (const level of EFFORT_LEVELS) {
    const opts = effortProviderOptions(m.id, level);
    const keys = Object.keys(opts);
    cells.push(keys.length === 0 ? '—' : JSON.stringify(opts[keys[0]]));

    // 🔑 MEDIUM MUST SEND NOTHING. It is every provider's own default, so the
    // day this ships nobody's behaviour changes. If this ever starts emitting
    // options, the default path has silently become a live experiment.
    if (level === 'medium') {
      check(`${m.id} @medium sends nothing`, keys.length === 0, opts);
    }

    // Models that cannot reason must never be sent a reasoning option.
    if (!supportsEffort(m.id)) {
      check(`${m.id} @${level} sends nothing (not a reasoning model)`, keys.length === 0, opts);
      continue;
    }

    if (level === 'medium') continue;

    check(`${m.id} @${level} emits options`, keys.length === 1, opts);

    // The namespace has to match the provider or it is silently ignored, which
    // would make the whole slider a no-op that still looks wired up.
    const ns = keys[0];
    const expected = /^claude-/.test(m.id) ? 'anthropic'
      : /^gemini-3/.test(m.id) ? 'google'
      : (/^gpt-5/.test(m.id) || /^o\d/.test(m.id)) ? 'openai' : null;
    check(`${m.id} @${level} uses the ${expected} namespace`, ns === expected, { got: ns, expected });

    // Anthropic: budgetTokens >= 1024 (API minimum) and strictly under maxTokens,
    // or the whole budget is thinking and nothing visible is emitted.
    if (ns === 'anthropic') {
      const t = (opts.anthropic as { thinking?: { budgetTokens?: number } }).thinking;
      const b = t?.budgetTokens ?? 0;
      check(`${m.id} @${level} budgetTokens >= 1024`, b >= 1024, b);
      check(`${m.id} @${level} budgetTokens < maxTokens(${cap})`, b < cap, { b, cap });
    }
    if (ns === 'google') {
      const b = (opts.google as { thinkingConfig?: { thinkingBudget?: number } }).thinkingConfig?.thinkingBudget ?? 0;
      check(`${m.id} @${level} thinkingBudget < maxTokens(${cap})`, b > 0 && b < cap, { b, cap });
    }
    if (ns === 'openai') {
      const e = (opts.openai as { reasoningEffort?: string }).reasoningEffort;
      check(`${m.id} @${level} reasoningEffort is the level`, e === level, e);
    }

    // providerOptions is serialised to JSON on the wire.
    check(`${m.id} @${level} is JSON-serialisable`, (() => {
      try { JSON.parse(JSON.stringify(opts)); return true; } catch { return false; }
    })());
  }

  console.log(
    `   ${m.id.padEnd(24)} ${isReasoningModel(m.id) ? 'reasoning' : 'plain    '}  ` +
    EFFORT_LEVELS.map((l, i) => `${l}=${cells[i]}`).join('  '),
  );
}

console.log('\n── default resolution ──');
check('undefined userData falls back to the default', effortFor(undefined) === DEFAULT_EFFORT);
check('missing settings falls back', effortFor({}) === DEFAULT_EFFORT);
check('garbage value falls back', effortFor({ settings: { reasoningEffort: 'turbo' } }) === DEFAULT_EFFORT);
check('a valid value is honoured', effortFor({ settings: { reasoningEffort: 'low' } }) === 'low');
// Shipping a non-medium default silently changes cost and quality for everyone.
check(`the default is 'medium' (change deliberately)`, DEFAULT_EFFORT === 'medium', DEFAULT_EFFORT);

const reasoners = PLATFORM_MODELS.filter(m => supportsEffort(m.id));
console.log(`\n${reasoners.length}/${PLATFORM_MODELS.length} models can control effort.`);
console.log(`cannot: ${PLATFORM_MODELS.filter(m => !supportsEffort(m.id)).map(m => m.id).join(', ') || '(none)'}`);
console.log(failures === 0 ? '\n✅ every model x level sends a legal shape\n' : `\n❌ ${failures} failure(s)\n`);
process.exit(failures === 0 ? 0 : 1);
