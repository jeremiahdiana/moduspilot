/**
 * Fail if any catalog model has no cost weight, and print what the ceilings
 * actually bound in dollars.
 *
 * This exists because the failure it catches is SILENT. Add a model to
 * lib/models.ts, forget lib/chat/model-cost.ts, and nothing breaks: the model
 * answers, usage increments, the limit still looks enforced. It is just billed
 * against the budget at the fallback weight instead of its own, and nobody finds
 * out from the product. The same shape of mistake as the spelling-keyed model
 * constraint in lib/chat/model-params.ts — a second call site that has to
 * remember something.
 *
 *   cd apps/web && npx tsx scripts/verify-model-cost.ts
 */
import { PLATFORM_MODELS } from '../lib/models';
import { costWeight, weightedTokens, estimatedCostUsd, pricedModelIds, isEstimatedPrice } from '../lib/chat/model-cost';
import { MODUS_WEEKLY_LIMIT, PILOT_WEEKLY_LIMIT, MODUS_TOKEN_LIMIT, PILOT_TOKEN_LIMIT } from '../lib/constants';

const MODUS_PRICE = 24;   // $/mo, app/pricing/page.tsx
const PILOT_PRICE = 59;   // $/mo, app/pricing/page.tsx

let failed = false;

console.log('\n── cost weights ───────────────────────────────────────────');
console.log('model                      weight   $/1M blended   source');
for (const m of PLATFORM_MODELS) {
  const w = costWeight(m.id);
  const usdPerM = estimatedCostUsd(m.id, 1_000_000);
  const priced = pricedModelIds().includes(m.id);
  const src = !priced ? '❌ MISSING' : isEstimatedPrice(m.id) ? '⚠️  estimated' : '✅ published';
  if (!priced) failed = true;
  console.log(`${m.id.padEnd(26)} ${String(w).padStart(4)}x   ${('$' + usdPerM.toFixed(2)).padStart(10)}    ${src}`);
}

// What the weekly ceiling costs if a user spends ALL of it on one model.
console.log('\n── worst-case monthly spend per user, all budget on one model ──');
console.log('model                      plan     tokens/wk    $/month   vs price');
for (const m of PLATFORM_MODELS) {
  for (const [plan, weekly, price] of [
    ['modus', MODUS_WEEKLY_LIMIT, MODUS_PRICE],
    ['pilot', PILOT_WEEKLY_LIMIT, PILOT_PRICE],
  ] as const) {
    if (!m.plans.includes(plan)) continue;
    const rawTokens = Math.floor(weekly / costWeight(m.id));
    const monthly = estimatedCostUsd(m.id, rawTokens) * (52 / 12);
    const ratio = monthly / price;
    const flag = ratio > 1 ? '🚨 LOSS' : ratio > 0.5 ? '⚠️  thin' : '✅';
    console.log(
      `${m.id.padEnd(26)} ${plan.padEnd(6)} ${rawTokens.toLocaleString().padStart(11)}` +
      `  ${('$' + monthly.toFixed(2)).padStart(8)}   ${(ratio * 100).toFixed(0).padStart(3)}%  ${flag}`,
    );
    // Inference above the subscription price is the exact bug this shipped to fix.
    if (ratio > 1) failed = true;
  }
}

// The weighting must actually change something, or it is decoration.
const cheap = weightedTokens('meta/llama-3.3-70b', 1000);
const dear  = weightedTokens('claude-fable-5', 1000);
console.log(`\n1000 raw tokens → Llama 3.3: ${cheap} units · Fable 5: ${dear} units (${(dear / cheap).toFixed(1)}x)`);
if (dear <= cheap) {
  console.log('❌ the most expensive model does not cost more budget than the cheapest');
  failed = true;
}

// An unlisted id must fail EXPENSIVE, never at 1x.
const unknown = costWeight('some-model-nobody-added-yet');
console.log(`unknown model id → ${unknown}x  ${unknown >= dear / 1000 * 1000 ? '' : ''}`);
if (unknown < Math.max(...PLATFORM_MODELS.map(m => costWeight(m.id)))) {
  console.log('❌ an unknown model id is weighted below the catalog maximum — it would be served at a loss');
  failed = true;
}

console.log(`\ndaily ceilings:  modus ${MODUS_TOKEN_LIMIT.toLocaleString()}  ·  pilot ${PILOT_TOKEN_LIMIT.toLocaleString()} cost units`);
console.log(failed ? '\n❌ FAILED\n' : '\n✅ every catalog model is priced and no plan loses money at its ceiling\n');
process.exit(failed ? 1 : 0);
