/**
 * Auto (Saver) routing, as executable checks.
 *
 * The whole point of Auto Saver is COST: it must route every task to a cheap
 * model so the user's cost-weighted allowance lasts far longer. That guarantee is
 * only worth anything if it cannot silently regress — an innocent-looking edit to
 * SAVER_PREFERENCE (swap DeepSeek for Sonnet "because it's better") would quietly
 * turn the saver into ordinary Auto and blow the budget it exists to protect.
 *
 * So this pins, as a build gate:
 *   - every model Saver can route to is weight <= 2 and exists in the catalog
 *   - on the modus plan, Saver's resolved model for each task is weight <= 2
 *   - Saver never costs MORE than plain Auto for the same task
 *
 *   cd apps/web && npx tsx scripts/verify-auto-saver.ts
 */
import { pickModel, SAVER_PREFERENCE } from '../lib/chat/auto-route';
import type { TaskCategory } from '../lib/chat/auto-route';
import { costWeight } from '../lib/chat/model-cost';
import { PLATFORM_MODELS } from '../lib/models';

const SAVER_MAX_WEIGHT = 2;

let failed = false;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed = true;
}

const categories = Object.keys(SAVER_PREFERENCE) as TaskCategory[];

// ── 1. Every id Saver can name is cheap and real ────────────────────────────
console.log('\n── saver preference ids ──');
for (const cat of categories) {
  for (const id of SAVER_PREFERENCE[cat]) {
    const inCatalog = PLATFORM_MODELS.some(m => m.id === id);
    const w = costWeight(id);
    check(`${cat} → ${id}  (${w}x)`, inCatalog && w <= SAVER_MAX_WEIGHT,
      !inCatalog ? 'not in PLATFORM_MODELS' : w > SAVER_MAX_WEIGHT ? `weight ${w} exceeds ${SAVER_MAX_WEIGHT}` : '');
  }
}

// ── 2. On modus, the RESOLVED saver model is cheap, and never dearer than Auto ─
console.log('\n── resolved on modus: saver vs plain Auto ──');
for (const cat of categories) {
  const saverId = pickModel(cat, 'modus', true);
  const autoId  = pickModel(cat, 'modus', false);
  const sw = costWeight(saverId);
  const aw = costWeight(autoId);
  check(`${cat}: saver=${saverId} (${sw}x) ≤ ${SAVER_MAX_WEIGHT}`, sw <= SAVER_MAX_WEIGHT);
  check(`${cat}: saver never dearer than Auto (${autoId} ${aw}x)`, sw <= aw, `saver ${sw}x vs auto ${aw}x`);
}

// ── 3. Saver actually differs from Auto somewhere (or it is pointless) ───────
const differs = categories.some(cat => pickModel(cat, 'modus', true) !== pickModel(cat, 'modus', false));
check('\nsaver routes differently from Auto on at least one task', differs);

console.log(
  failed
    ? '\n❌ FAILED — Auto Saver no longer guarantees the cheap path.\n'
    : '\n✅ Auto Saver routes cheap on every task and never costs more than Auto.\n',
);
process.exit(failed ? 1 : 0);
