/**
 * The free plan, as executable checks.
 *
 * 🧊 WHAT THE FREE TIER IS NOW. The OPEN models only (Llama, DeepSeek and the two
 * Gemini Flashes), on a rolling WINDOW_HOURS window plus a weekly ceiling — a real,
 * ongoing free tier, not the old lifetime count of 10 messages on any model. The
 * frontier models are the reason to upgrade. It is still the single riskiest thing
 * in the codebase to get wrong: every defect is either "strangers get frontier
 * models for free" or "the free tier costs more than it should", and neither shows
 * up in the product until the bill does.
 *
 * The gate is now a pure read of the window/weekly counters (no Firestore write),
 * so these checks run entirely in-memory against plain user docs.
 *
 *   cd apps/web && npx tsx scripts/verify-free-tier.ts
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

import {
  enforceSubscriptionGate,
  enforcePaidTokenLimit,
  isFreeTierUser,
  getWeekKey,
} from '../lib/chat/limits';
import {
  FREE_WINDOW_LIMIT,
  FREE_WEEKLY_LIMIT,
  FREE_MAX_MESSAGE_CHARS,
  FREE_HISTORY_CHAR_BUDGET,
  WINDOW_MS,
  MODUS_WINDOW_LIMIT,
  MODUS_WEEKLY_LIMIT,
} from '../lib/constants';
import { FREE_DEFAULT, resolveChatModel } from '../lib/chat/model';
import { PLATFORM_MODELS, canUseModel } from '../lib/models';
import { pickModel, type TaskCategory } from '../lib/chat/auto-route';
import { hasActiveAccess } from '../lib/plan';
import { isBriefingDue } from '../lib/capabilities';
import { estimatedCostUsd, BASELINE_USD_PER_1M } from '../lib/chat/model-cost';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}
function section(s: string) { console.log(`\n── ${s} ──`); }

// A free user doc with a fresh window inside the current week.
function freeDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { windowStart: Date.now(), windowTokens: 0, tokenWeek: getWeekKey(), weeklyTokens: 0, ...overrides };
}

const FREE_OPEN = ['meta/llama-3.3-70b', 'deepseek/deepseek-v3.1', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const FRONTIER = ['claude-sonnet-5', 'claude-opus-4-8', 'claude-fable-5', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gemini-3.1-pro-preview', 'meta/llama-4-maverick'];

async function main() {
  section('1  the free window + weekly ceiling allow, then block');
  {
    check('a free user under both ceilings is allowed', enforceSubscriptionGate('u', freeDoc()) === null);

    const overWindow = enforceSubscriptionGate('u', freeDoc({ windowTokens: FREE_WINDOW_LIMIT }));
    check('at the window ceiling → blocked', overWindow !== null);
    check('the window block is 402', overWindow?.status === 402);
    const wBody = await overWindow!.clone().json();
    check('the window block is free_limit_reached', wBody.error === 'free_limit_reached', `got=${wBody.error}`);

    const overWeek = enforceSubscriptionGate('u', freeDoc({ weeklyTokens: FREE_WEEKLY_LIMIT }));
    check('at the weekly ceiling → blocked (even with a fresh window)', overWeek !== null);
    const kBody = await overWeek!.clone().json();
    check('the weekly block is free_limit_reached', kBody.error === 'free_limit_reached', `got=${kBody.error}`);
  }

  section('2  the block is DISTINCT from subscription_required');
  {
    const blocked = enforceSubscriptionGate('u', freeDoc({ windowTokens: FREE_WINDOW_LIMIT }));
    const body = await blocked!.clone().json();
    check('a spent free user gets free_limit_reached', body.error === 'free_limit_reached');
    check('NOT the generic subscription_required', body.error !== 'subscription_required');
  }

  section('3  🕔 the window ROLLS — an expired window and a stale week both count 0');
  {
    const expired = {
      windowStart: Date.now() - WINDOW_MS - 60_000,
      windowTokens: FREE_WINDOW_LIMIT * 10,
      tokenWeek: '2000-01-03',
      weeklyTokens: FREE_WEEKLY_LIMIT * 10,
    };
    check('an expired window + stale week is allowed again', enforceSubscriptionGate('u', expired) === null);

    // A live window still blocks; only expiry frees it.
    check('a live over-limit window still blocks',
      enforceSubscriptionGate('u', freeDoc({ windowTokens: FREE_WINDOW_LIMIT })) !== null);
  }

  section('4  the gate is a pure READ — it never mutates the user doc');
  {
    const doc = freeDoc({ windowTokens: 5, weeklyTokens: 5 });
    const before = JSON.stringify(doc);
    enforceSubscriptionGate('u', doc);
    check('enforceSubscriptionGate does not write freeMessagesUsed or anything else',
      JSON.stringify(doc) === before && !('freeMessagesUsed' in doc));
  }

  section('5  paid accounts are untouched by the free gate');
  {
    check('a paying user is never blocked by the free gate', enforceSubscriptionGate('u', { plan: 'modus' }) === null);
    check('isFreeTierUser is false for a paid plan', !isFreeTierUser({ plan: 'modus' }));
    check('isFreeTierUser is true when plan is simply absent', isFreeTierUser({}));

    // Paid users are still gated by THEIR own ceiling, not the free one.
    const overPaid = { plan: 'modus', windowStart: Date.now(), windowTokens: MODUS_WINDOW_LIMIT, tokenWeek: getWeekKey(), weeklyTokens: 0 };
    check('a paid user over its own window is blocked (token_limit_reached)', enforcePaidTokenLimit(overPaid) !== null);
    check('the free gate does not double-gate a paid user', enforceSubscriptionGate('u', overPaid) === null);
  }

  section('6  MODEL ACCESS — free is the OPEN models only; frontier stays paid');
  {
    check('the free set is exactly the open models',
      JSON.stringify(PLATFORM_MODELS.filter(m => m.plans.includes('free')).map(m => m.id).sort())
        === JSON.stringify([...FREE_OPEN].sort()),
      PLATFORM_MODELS.filter(m => m.plans.includes('free')).map(m => m.id).join(', '));

    for (const id of FREE_OPEN) check(`free CAN use ${id}`, canUseModel(id, undefined));
    for (const id of FRONTIER) check(`free CANNOT use ${id}`, !canUseModel(id, undefined));

    // The paid gate must stay intact: a MODUS user cannot reach a PILOT model.
    check('a MODUS user still CANNOT reach a PILOT model', !canUseModel('claude-opus-4-8', 'modus'));

    // resolveChatModel: a free pick of a frontier model is served a free model, not the frontier one.
    const pickFree = resolveChatModel({ plan: undefined, settings: { modelSettings: { provider: 'platform', model: 'gemini-3.5-flash' } } }, {});
    check('free user picking Gemini Flash (a free model) is served it', pickFree.modelId === 'gemini-3.5-flash', `served=${pickFree.modelId}`);
    const pickFrontier = resolveChatModel({ plan: undefined, settings: { modelSettings: { provider: 'platform', model: 'claude-sonnet-5' } } }, { modelId: 'claude-sonnet-5' });
    check('free user picking Sonnet 5 is downgraded off it', pickFrontier.modelId !== 'claude-sonnet-5', `served=${pickFrontier.modelId}`);
    const unchosen = resolveChatModel({ plan: undefined }, {});
    check('free user with no saved Brain gets FREE_DEFAULT', unchosen.modelId === FREE_DEFAULT, `served=${unchosen.modelId}`);
  }

  section('7  Auto never routes a free user to a paid model');
  {
    // The one leak the model gate does NOT cover: Auto picks a model for the user.
    // pickModel is plan-aware (effectivePlan → free), so every category must resolve
    // to a free-reachable model. If it ever falls through to a paid one, a free user
    // on Auto — the default — silently gets frontier inference for nothing.
    const cats: TaskCategory[] = ['writing', 'research', 'code', 'reasoning', 'general', 'product'];
    for (const cat of cats) {
      const id = pickModel(cat, undefined);
      const m = PLATFORM_MODELS.find(x => x.id === id);
      check(`Auto routes ${cat} to a free model for a free user (${id})`, !!m && m.plans.includes('free'));
    }
  }

  section('8  💸 what the free tier actually costs');
  {
    check('history budget exceeds the per-message cap (or a paste is evicted next turn)',
      FREE_HISTORY_CHAR_BUDGET > FREE_MAX_MESSAGE_CHARS, `${FREE_HISTORY_CHAR_BUDGET} > ${FREE_MAX_MESSAGE_CHARS}`);

    // 🔑 The weekly unit ceiling bounds DOLLARS directly: one budget unit is
    // BASELINE_USD_PER_1M per 1M REGARDLESS of model (a dearer model burns
    // proportionally more units per token). Unlike the old lifetime cap this is an
    // ONGOING cost — the window refreshes — so the figure that matters is per ACTIVE
    // free user per MONTH, at the absolute worst (every unit spent).
    const worstWeeklyUsd = (FREE_WEEKLY_LIMIT / 1_000_000) * BASELINE_USD_PER_1M;
    const worstMonthlyUsd = worstWeeklyUsd * (30 / 7);
    console.log(`   unit price: $${BASELINE_USD_PER_1M.toFixed(2)}/1M · free weekly ceiling: ${FREE_WEEKLY_LIMIT.toLocaleString()} units`);
    console.log(`   worst case per ACTIVE free user: $${worstWeeklyUsd.toFixed(2)}/week → $${worstMonthlyUsd.toFixed(2)}/month (every unit spent)`);
    console.log(`   ⚠️ AGGREGATE at scale: 1,000 active free users → $${(worstMonthlyUsd * 1000).toFixed(0)}/mo   ·   10,000 → $${(worstMonthlyUsd * 10000).toFixed(0)}/mo`);
    console.log(`   (this is the ABSOLUTE worst — every unit burned on the dearest free model at full output. Typical usage is far below.)`);
    // ~$2/mo worst case per active free user is the accepted ceiling for the ongoing
    // free tier. Headroom to $3 so a costing tweak fails LOUDLY here rather than
    // drifting. If the aggregate is ever unacceptable, the lever is a GLOBAL monthly
    // free-inference budget, never lowering maxTokens (reasoning models blank low).
    check('worst-case monthly cost per active free user stays under $3', worstMonthlyUsd < 3, `$${worstMonthlyUsd.toFixed(2)}`);

    // Free is DELIBERATELY more limited than MODUS.
    check('free window is well below the MODUS window', FREE_WINDOW_LIMIT < MODUS_WINDOW_LIMIT, `${FREE_WINDOW_LIMIT} < ${MODUS_WINDOW_LIMIT}`);
    check('free weekly is well below the MODUS weekly', FREE_WEEKLY_LIMIT < MODUS_WEEKLY_LIMIT, `${FREE_WEEKLY_LIMIT} < ${MODUS_WEEKLY_LIMIT}`);

    // The dearest free model is Gemini Flash; nothing pricier is free-reachable.
    const freeModels = PLATFORM_MODELS.filter(m => m.plans.includes('free'));
    const dearest = freeModels.reduce((a, b) => estimatedCostUsd(b.id, 1e6) > estimatedCostUsd(a.id, 1e6) ? b : a);
    check('the dearest free-reachable model is Gemini 3.5 Flash', dearest.id === 'gemini-3.5-flash', `dearest=${dearest.id}`);
    const flashBlended = estimatedCostUsd('gemini-3.5-flash', 1e6);
    check('no free model is pricier than Gemini Flash',
      freeModels.every(m => estimatedCostUsd(m.id, 1e6) <= flashBlended + 1e-9));
  }

  section('9  LIFECYCLE — cancel drops to the free window, not a lockout');
  {
    // What billing.ts writes when the last subscription ends.
    const CANCELLED = { plan: 'free', subscriptionId: null, limitAddonQty: 0 };
    check('a cancelled subscriber IS a free-tier user (soft landing)', isFreeTierUser(CANCELLED));
    check('…and hasActiveAccess correctly rejects them', !hasActiveAccess(CANCELLED));
    check('a cancelled subscriber under the free ceiling is allowed',
      enforceSubscriptionGate('u', { ...CANCELLED, ...freeDoc() }) === null);
    check('a cancelled subscriber over the free window is blocked',
      enforceSubscriptionGate('u', { ...CANCELLED, ...freeDoc({ windowTokens: FREE_WINDOW_LIMIT }) }) !== null);
    // Subscribing restores full access regardless of free counters.
    check('subscribing restores access', enforceSubscriptionGate('u', { plan: 'modus', ...freeDoc({ windowTokens: FREE_WINDOW_LIMIT }) }) === null);
  }

  section('10 💸 nothing else calls a model for a free user');
  {
    // Briefings are a PAID feature and cost a model call a day. A free account must
    // never be due one, or every free signup gets daily inference outside the window.
    const hour = 7;
    const onboardedFree = { onboardingComplete: true, settings: { briefingHour: hour } };
    check('a free user is NOT due a daily briefing', !isBriefingDue(onboardedFree, hour));
    check('a paying user still is', isBriefingDue({ ...onboardedFree, plan: 'modus' }, hour));
    check('a cancelled subscriber is not', !isBriefingDue({ ...onboardedFree, plan: 'free' }, hour));
  }

  console.log(failures === 0
    ? '\n✅ FREE TIER HOLDS — open models only, windowed, bounded in dollars, and the frontier stays paid.'
    : `\n❌ ${failures} FAILURE(S)`);
}

main()
  .catch(e => { console.error(e); failures++; })
  .finally(() => process.exit(failures === 0 ? 0 : 1));
