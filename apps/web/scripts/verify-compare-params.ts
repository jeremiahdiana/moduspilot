/**
 * Compare mode must send every catalog model the SAME provider constraints the
 * chat route does.
 *
 * 🪤 THE FIX ON 2026-07-23 LANDED IN ONE OF TWO CALL SITES.
 *
 * `claude-opus-4-8` 400'd on every chat message because the temperature guard was
 * `/^claude-.*-5$/` — true of sonnet-5 and fable-5, false of opus. That was fixed
 * by moving both predicates into lib/chat/model-params.ts, keyed on family.
 *
 * app/api/chat/compare/route.ts has its OWN streamText call and inherits nothing.
 * It kept the original inline regexes, so the identical two breakages survived in
 * compare mode — the multi-model differentiator — where a dead Opus column reads
 * as "Opus lost the comparison" rather than as an error.
 *
 * verify-model-params.ts stayed green throughout, because it tests the module the
 * broken call site does not import. A green light you have not seen go red is not
 * evidence.
 *
 *   cd apps/web && npx tsx scripts/verify-compare-params.ts          # static
 *   cd apps/web && npx tsx scripts/verify-compare-params.ts --live   # + real calls
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { readFileSync } from 'fs';
import { streamText } from 'ai';
import { PLATFORM_MODELS } from '../lib/models';
import { needsExplicitTemperature, maxTokensFor } from '../lib/chat/model-params';
import { resolveChatModel } from '../lib/chat/model';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
}

// ── 1. The compare route must not carry its own copy of the constraints ──
console.log('\n── compare/route.ts must use the shared predicates ──');
const src = readFileSync(resolve(__dirname, '../app/api/chat/compare/route.ts'), 'utf8');
const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

check(
  'imports from lib/chat/model-params (not inline regexes)',
  /from '@\/lib\/chat\/model-params'/.test(code),
);
check(
  'no inline `-5$` version-suffix test survives in executable code',
  !/-5\$\//.test(code),
  code.split('\n').filter(l => /-5\$\//.test(l)),
);
check(
  'maxTokens comes from maxTokensFor()',
  /maxTokens:\s*maxTokensFor\(/.test(code),
);
check(
  'temperature comes from needsExplicitTemperature()',
  /needsExplicitTemperature\(/.test(code),
);

// ── 2. Every catalog model, through the compare route's own resolver ──
console.log('\n── what compare mode would send each catalog model ──');
for (const m of PLATFORM_MODELS) {
  const temp = needsExplicitTemperature(m.id) ? '1' : 'default';
  console.log(`   ${m.id.padEnd(24)} temperature=${temp.padEnd(8)} maxTokens=${maxTokensFor(m.id)}`);
}

console.log('\n── the models the old inline regexes missed ──');
// `/^o\d/ || /^gpt-5/ || /-5$/ || /^gemini-3/` and `/^claude-.*-5$/`
const OLD_REASONING = (id: string) => /^o\d/.test(id) || /^gpt-5/.test(id) || /-5$/.test(id) || /^gemini-3/.test(id);
const OLD_TEMPERATURE = (id: string) => /^claude-.*-5$/.test(id);
for (const m of PLATFORM_MODELS) {
  const tempDrift = needsExplicitTemperature(m.id) !== OLD_TEMPERATURE(m.id);
  const capDrift = (maxTokensFor(m.id) === 16000) !== OLD_REASONING(m.id);
  if (tempDrift || capDrift) {
    console.log(`   ⚠️  ${m.id}: ${[tempDrift && 'temperature dropped', capDrift && 'reasoning headroom dropped'].filter(Boolean).join(' + ')}`);
  }
}
check(
  'claude-opus-4-8 — the model both old regexes missed — now gets temperature',
  needsExplicitTemperature('claude-opus-4-8'),
);
check(
  'claude-opus-4-8 gets reasoning headroom in compare mode too',
  maxTokensFor('claude-opus-4-8') === 16000,
  maxTokensFor('claude-opus-4-8'),
);

// ── 3. Live round-trip: a catalog entry is a promise that the model answers ──
async function live() {
  console.log('\n── live: every catalog model answers with compare mode\'s params ──');
  const PROMPT = 'In one sentence, what is the capital of France?';
  const pilot = { plan: 'pilot' } as Record<string, any>;

  for (const m of PLATFORM_MODELS) {
    const resolved = resolveChatModel(pilot, { modelId: m.id });
    if (resolved.downgraded) {
      // Compare mode 503s here rather than showing the same model twice.
      console.log(`   ⏭️  ${m.id.padEnd(24)} not configured (compare mode 503s) — skipped`);
      continue;
    }
    try {
      const result = streamText({
        model: resolved.model,
        system: 'Answer the user directly and concisely.',
        prompt: PROMPT,
        maxTokens: maxTokensFor(resolved.modelId),
        ...(needsExplicitTemperature(resolved.modelId) ? { temperature: 1 } : {}),
      });
      let text = '';
      for await (const chunk of result.textStream) text += chunk;
      const finish = await result.finishReason;
      check(
        `${m.id.padEnd(24)} → ${String(text.length).padStart(4)} chars, finish=${finish}`,
        text.trim().length > 0 && finish !== 'length',
      );
    } catch (e) {
      check(`${m.id.padEnd(24)} → threw`, false, e instanceof Error ? e.message : e);
    }
  }
}

(async () => {
  if (process.argv.includes('--live')) await live();
  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
