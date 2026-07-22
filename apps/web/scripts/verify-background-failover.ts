/**
 * Every background AI job must survive a rate-limited Gateway.
 *
 * 🚨 THE SILENT OUTAGE THIS EXISTS FOR. Chat has had a failover chain for months.
 * Nothing else did. memory extraction, the daily briefing, proactive nudges and
 * goal planning each called the Gateway directly, caught their own error, and
 * returned null/[]. So with the Gateway on its rate-limited free tier, prod
 * logged this on essentially EVERY request and nothing surfaced anywhere:
 *
 *   [memory] extraction failed: AI_RetryError: Failed after 3 attempts.
 *   Last error: Free tier requests on this model are rate-limited.
 *
 * MODUS stopped learning anything about the user, silently, for as long as the
 * balance stayed low — the life-OS wedge failing quietly. Two Gateway models is
 * NOT two fallbacks either: they share one account and one tier, so a 429 takes
 * both down in the same instant (briefing.ts and proactive-model.ts both looked
 * three deep and were effectively one).
 *
 * A background job may degrade. It may not go silent.
 *
 *   cd apps/web && npx tsx scripts/verify-background-failover.ts        # structure
 *   cd apps/web && npx tsx scripts/verify-background-failover.ts --live # + real call
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log(`   ${JSON.stringify(detail)}`); }
}

const GATEWAY = 'ai-gateway.vercel.sh';

/** Read a source file and report whether it still pins a bare Gateway model. */
function sourceOf(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

async function main() {
  const { backgroundModel } = await import('../lib/chat/model');

  console.log('\n── the shared helper ──');
  const m = backgroundModel('meta/llama-3.3-70b', 'test') as { modelId: string };
  check('backgroundModel returns a usable model', !!m && typeof m.modelId === 'string', m?.modelId);

  // With both keys present it MUST be a chain, not a single model — a single
  // model is exactly the bug (createFallbackModel returns models[0] for len<=1).
  const hasGateway = !!process.env.AI_GATEWAY_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();
  check('both AI_GATEWAY_API_KEY and OPENAI_API_KEY are present for this check', hasGateway && hasOpenAI,
    { hasGateway, hasOpenAI });

  console.log('\n── no background caller may pin a bare Gateway model ──');
  // memory/auto-route/goals must route through backgroundModel.
  for (const [path, label] of [
    ['lib/chat/memory.ts', 'memory extraction'],
    ['lib/chat/auto-route.ts', 'the auto-route classifier'],
    ['app/api/goals/plan/route.ts', 'goal milestones'],
    ['app/api/goals/suggestions/route.ts', 'goal suggestions'],
  ] as const) {
    const src = sourceOf(path);
    check(`${label} (${path}) uses backgroundModel`, src.includes('backgroundModel('));
    check(`${label} no longer constructs its own Gateway client`, !src.includes(GATEWAY), path);
  }

  console.log('\n── chains that were two Gateway links deep now reach a direct key ──');
  for (const [path, label] of [
    ['lib/briefing.ts', 'daily briefing'],
    ['lib/proactive-model.ts', 'proactive jobs'],
  ] as const) {
    const src = sourceOf(path);
    check(`${label} (${path}) appends a gpt-4o-mini link on a direct key`,
      src.includes("createOpenAI({ apiKey: openAIKey")
      || src.includes("createOpenAI({ apiKey: openAIKeyForBriefing"));
    check(`${label} still keeps the cheap Gateway models first`, src.includes("groq('meta/llama-3.3-70b')"));
  }

  if (process.argv.includes('--live')) {
    console.log('\n── live: a real extraction against the real providers ──');
    const { extractDurableMemory } = await import('../lib/chat/memory');
    const started = Date.now();
    const fact = await extractDurableMemory(
      'I just moved to Sydney and I am raising a pre-seed round for my startup MODUS.',
      'Congrats on the move — a pre-seed for MODUS from Sydney is a solid setup.',
    );
    console.log(`   → ${JSON.stringify(fact)}  (${Date.now() - started}ms)`);
    check('extraction returns a durable fact instead of null', typeof fact === 'string' && fact.length > 12, fact);
  }

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\n❌', e); process.exit(1); });
