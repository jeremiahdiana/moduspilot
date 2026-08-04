/**
 * Plan changes must never silently reprice someone.
 *
 *   cd apps/web && npx tsx scripts/verify-plan-change.ts
 *
 * Two defects this locks down (both found 2026-08-02, both live before the fix):
 *   - /api/stripe/change-plan held its OWN monthly-only price map, so an annual
 *     subscriber who changed plan was moved onto monthly billing without asking.
 *   - A founding member changing plan was repriced from their $24 rate onto the
 *     $59 list price, permanently. The founding discount is only the mismatch
 *     between the $24 price and plan:'pilot' — nothing else protects it.
 *
 * The resolver is exercised with INJECTED env values so it tests the logic, not
 * whichever price ids happen to be in the local .env. Any real price ids present
 * are additionally checked against Stripe for the interval they claim to have.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}
function section(s: string) { console.log(`\n── ${s} ──`); }

// A minimal subscription shape — only the fields the two helpers read.
function fakeSub(interval: 'month' | 'year', metadata: Record<string, string> = {}) {
  return { items: { data: [{ price: { recurring: { interval } } }] }, metadata } as never;
}

async function main() {
  const { resolvePlanPrice } = await import('@/lib/pricing');
  const { cadenceOfSubscription, isFoundingSubscription } = await import('@/lib/billing');
  const { stripe } = await import('@/lib/stripe');

  console.log('🔁 plan-change safety\n');

  section('1 cadence is read off the LIVE subscription');
  check('yearly interval → annual', cadenceOfSubscription(fakeSub('year')) === 'annual');
  check('monthly interval → monthly', cadenceOfSubscription(fakeSub('month')) === 'monthly');
  check('missing price data → monthly (never invent annual)',
    cadenceOfSubscription({ items: { data: [] }, metadata: {} } as never) === 'monthly');

  section('2 the resolver honours cadence (injected ids, so this tests LOGIC)');
  {
    const saved = { ...process.env };
    process.env.STRIPE_PRICE_MODUS = 'price_modus_m';
    process.env.STRIPE_PRICE_MODUS_ANNUAL = 'price_modus_y';
    process.env.STRIPE_PRICE_PILOT = 'price_pilot_m';
    process.env.STRIPE_PRICE_PILOT_ANNUAL = 'price_pilot_y';
    process.env.STRIPE_PRICE_LIMIT_ADDON = 'price_addon_m';

    const a = resolvePlanPrice('pilot', 'annual');
    check('annual subscriber → ANNUAL price (was: silently monthly)',
      a.priceId === 'price_pilot_y' && a.cadence === 'annual', `${a.priceId} / ${a.cadence}`);
    const m = resolvePlanPrice('pilot', 'monthly');
    check('monthly subscriber → monthly price', m.priceId === 'price_pilot_m' && m.cadence === 'monthly');
    // The monthly-only tier used to be Group. Group was removed on 2026-08-04
    // (multi-seat moves to Enterprise), and the limits add-on took over as the
    // one purchasable thing with no annual price — so the honest-fallback
    // invariant is now pinned on it.
    const g = resolvePlanPrice('limitAddon', 'annual');
    check('the add-on has no annual → reports the monthly fallback HONESTLY',
      g.priceId === 'price_addon_m' && g.cadence === 'monthly', `${g.priceId} / ${g.cadence}`);
    check('group is no longer purchasable at all',
      resolvePlanPrice('group', 'monthly').priceId === undefined);
    check('unknown plan → no price', resolvePlanPrice('bogus', 'monthly').priceId === undefined);

    // A missing annual env must degrade to monthly, not 400 someone out of checkout.
    delete process.env.STRIPE_PRICE_PILOT_ANNUAL;
    const f = resolvePlanPrice('pilot', 'annual');
    check('missing annual env → falls back to monthly and SAYS monthly',
      f.priceId === 'price_pilot_m' && f.cadence === 'monthly', `${f.priceId} / ${f.cadence}`);

    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }

  section('3 founding members are never repriced');
  check('users doc flag alone is enough', isFoundingSubscription({ founding: true }, fakeSub('month')));
  check('stripe metadata alone is enough', isFoundingSubscription({}, fakeSub('month', { founding: 'true' })));
  check('both present', isFoundingSubscription({ founding: true }, fakeSub('month', { founding: 'true' })));
  check('an ordinary subscriber is NOT locked', !isFoundingSubscription({ plan: 'pilot' }, fakeSub('month')));
  check('missing user data is not treated as founding', !isFoundingSubscription(null, fakeSub('month')));

  section('4 [STATIC] change-plan actually applies both guards');
  {
    const src = readFileSync(resolve(process.cwd(), 'app/api/stripe/change-plan/route.ts'), 'utf8');
    check('calls isFoundingSubscription', src.includes('isFoundingSubscription('));
    check('calls cadenceOfSubscription', src.includes('cadenceOfSubscription('));
    check('uses the shared resolver', src.includes('resolvePlanPrice('));
    check('no local monthly-only price map left behind', !src.includes('const PRICE_IDS'));
  }
  section('4b [STATIC] only ONE price resolver exists in the codebase');
  {
    // The original bug was a second, monthly-only copy living in a route.
    let out = '';
    try {
      out = execSync(`grep -rn "function resolvePlanPrice\\|function resolvePrice" app lib || true`,
        { encoding: 'utf8' }).trim();
    } catch { /* no matches */ }
    const lines = out ? out.split('\n') : [];
    check('exactly one definition, and it lives in lib/pricing.ts',
      lines.length === 1 && lines[0].startsWith('lib/pricing.ts'), out || 'none');
  }

  section('5 [STRIPE] the configured price ids really have the interval they claim');
  {
    const cases: Array<[string, 'month' | 'year']> = [
      ['STRIPE_PRICE_MODUS', 'month'], ['STRIPE_PRICE_PILOT', 'month'],
      // Group's price is retired; the add-on is the monthly-only one now.
      ['STRIPE_PRICE_LIMIT_ADDON', 'month'],
      ['STRIPE_PRICE_MODUS_ANNUAL', 'year'], ['STRIPE_PRICE_PILOT_ANNUAL', 'year'],
    ];
    for (const [env, want] of cases) {
      const id = process.env[env];
      if (!id) { console.log(`⏭️  SKIP  ${env} not set locally (it IS set in Vercel production)`); continue; }
      try {
        const price = await stripe.prices.retrieve(id);
        check(`${env} is a ${want}ly recurring price`,
          price.recurring?.interval === want,
          `interval=${price.recurring?.interval} amount=$${((price.unit_amount ?? 0) / 100).toFixed(2)}`);
      } catch (e) {
        check(`${env} resolves in Stripe`, false, (e as Error).message);
      }
    }
  }

  console.log(failures === 0
    ? '\n✅ PLAN CHANGES ARE SAFE — cadence preserved, founding rate protected, one resolver.'
    : `\n❌ ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
