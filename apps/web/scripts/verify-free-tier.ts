/**
 * The free taste tier, as executable checks.
 *
 * 🧊 WHY THIS EXISTS. Every paying MODUS account to date came from a warm personal
 * invite; cold traffic converted at ~0 because enforceSubscriptionGate demanded a
 * card before a stranger could send ONE message. The free tier is the fix, and it
 * is the single riskiest thing to get wrong in this codebase — every defect in it
 * is either "strangers get MODUS for free forever" or "the paywall stopped
 * working". Neither shows up in the product until the bill does.
 *
 * verify-new-consumer.ts does NOT cover this: it sets plan='modus' and tests the
 * paid path. Nothing else exercises an account with no subscription.
 *
 * Runs against real Firestore with throwaway user docs, all deleted in `finally`.
 * Touches no real user, no Stripe object, and spends nothing on inference.
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

import { adminDb } from '../lib/firebase-admin';
import { enforceSubscriptionGate, enforcePaidTokenLimit, isFreeTierUser } from '../lib/chat/limits';
import { FREE_MESSAGE_LIMIT, FREE_MAX_MESSAGE_CHARS, FREE_HISTORY_CHAR_BUDGET, MODUS_WINDOW_LIMIT } from '../lib/constants';
import { FREE_DEFAULT, resolveChatModel } from '../lib/chat/model';
import { PLATFORM_MODELS, isModelUnlocked, canUseModel } from '../lib/models';
import { maxTokensFor } from '../lib/chat/model-params';
import { hasActiveAccess } from '../lib/plan';
import { isBriefingDue } from '../lib/capabilities';
import { costWeight, estimatedCostUsd } from '../lib/chat/model-cost';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}
function section(s: string) { console.log(`\n── ${s} ──`); }

const temp: string[] = [];
async function freeUser(overrides: Record<string, unknown> = {}): Promise<string> {
  const uid = `_verify_free_${Math.random().toString(36).slice(2, 12)}`;
  // from a Firebase auth record that does not exist for a synthetic uid.
  await adminDb.collection('users').doc(uid).set({ ...overrides });
  temp.push(uid);
  return uid;
}
async function read(uid: string): Promise<Record<string, unknown>> {
  return (await adminDb.collection('users').doc(uid).get()).data() ?? {};
}

async function main() {
  section('1  a stranger gets exactly FREE_MESSAGE_LIMIT messages, then the wall');
  {
    const uid = await freeUser();
    let allowed = 0;
    let firstBlock: string | null = null;
    for (let i = 0; i < FREE_MESSAGE_LIMIT + 3; i++) {
      const blocked = await enforceSubscriptionGate(uid, await read(uid));
      if (!blocked) { allowed++; continue; }
      const body = await blocked.clone().json();
      firstBlock ??= `${blocked.status} ${body.error}`;
    }
    check(`exactly ${FREE_MESSAGE_LIMIT} messages allowed`, allowed === FREE_MESSAGE_LIMIT, `allowed=${allowed}`);
    check('the wall is 402 free_limit_reached', firstBlock === '402 free_limit_reached', `got=${firstBlock}`);
    check('counter persisted at the cap', (await read(uid)).freeMessagesUsed === FREE_MESSAGE_LIMIT,
      `freeMessagesUsed=${(await read(uid)).freeMessagesUsed}`);
  }

  section('2  the code is DISTINCT from subscription_required');
  {
    // 🚨 The copy depends on this. A user who has sent ten messages being told to
    // "start your 3-day free trial" reads as the product forgetting them, which is
    // exactly the moment they are deciding whether to pay.
    const uid = await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT });
    const blocked = await enforceSubscriptionGate(uid, await read(uid));
    const body = await blocked!.clone().json();
    check('spent free user gets free_limit_reached', body.error === 'free_limit_reached', `error=${body.error}`);
    check('NOT the generic subscription_required', body.error !== 'subscription_required');
  }

  section('3  🔒 concurrent requests cannot race past the cap');
  {
    // The bypass this closes: read-then-write outside a transaction lets N parallel
    // requests all observe the same count and all pass. A stranger has every
    // incentive to fire ten tabs at once.
    const uid = await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT - 1 });
    const data = await read(uid);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => enforceSubscriptionGate(uid, { ...data })),
    );
    const passed = results.filter(r => r === null).length;
    check('exactly ONE of 12 concurrent requests got the last message', passed === 1, `passed=${passed}`);
    check('counter never exceeded the cap', (await read(uid)).freeMessagesUsed === FREE_MESSAGE_LIMIT,
      `freeMessagesUsed=${(await read(uid)).freeMessagesUsed}`);
  }

  section('4  paid accounts are untouched by any of this');
  {
    const paid = await freeUser({ plan: 'modus' });
    check('a paying user is never charged a free message',
      (await enforceSubscriptionGate(paid, await read(paid))) === null && (await read(paid)).freeMessagesUsed === undefined,
      `freeMessagesUsed=${(await read(paid)).freeMessagesUsed}`);
    check('isFreeTierUser is false for a paid plan', !isFreeTierUser({ plan: 'modus' }));

    const gf = await freeUser({ plan: 'modus' });
    check('a paid user is never charged a free message',
      (await enforceSubscriptionGate(gf, await read(gf))) === null && (await read(gf)).freeMessagesUsed === undefined);
    check('isFreeTierUser is false for a paid plan', !isFreeTierUser({ plan: 'modus' }));

    // The one that would silently match nobody: the Stripe webhook never writes
    // plan:'free', so a free user's plan is ABSENT, not the string 'free'.
    check('isFreeTierUser is true when plan is simply absent', isFreeTierUser({}));
  }

  section('5  free tier TASTES any model; paid tiers stay in their lane');
  {
    check('FREE_DEFAULT is unlocked for the free plan', isModelUnlocked(FREE_DEFAULT, 'free'), FREE_DEFAULT);

    // 🧊 THE CHANGE. A signed-in free account may RUN any catalog model for its 10
    // lifetime messages. The side-by-side of frontier models is the product, and
    // gating it behind the card is why cold traffic converted at ~0. canUseModel is
    // the ONE accessor both chat gates (model.ts, route.ts) and compare read — this
    // section is what stops it drifting back to a per-tier lock.
    check('a free user CAN reach frontier models (metered by count, not tier)',
      canUseModel('claude-sonnet-5', undefined) && canUseModel('claude-fable-5', undefined) && canUseModel('gpt-5.6-terra', undefined));
    const pickFrontier = resolveChatModel({ plan: undefined, settings: { modelSettings: { provider: 'platform', model: 'claude-sonnet-5' } } }, {});
    check('free user picking Sonnet 5 is SERVED Sonnet 5, not downgraded', pickFrontier.modelId === 'claude-sonnet-5', `served=${pickFrontier.modelId}`);

    // 🚨 THE PAID GATE MUST STAY INTACT, or the tiers collapse and $59 buys what $24
    // does. A modus user still cannot reach a pilot model.
    check('a MODUS user still CANNOT reach a PILOT model', !canUseModel('claude-opus-4-8', 'modus'));
    const modusPicksPilot = resolveChatModel({ plan: 'modus', settings: { modelSettings: { provider: 'platform', model: 'claude-opus-4-8' } } }, { modelId: 'claude-opus-4-8' });
    check('MODUS user picking a PILOT model is downgraded off it', modusPicksPilot.modelId !== 'claude-opus-4-8', `served=${modusPicksPilot.modelId}`);

    const unchosen = resolveChatModel({ plan: undefined }, {});
    check('free user with no saved Brain gets FREE_DEFAULT', unchosen.modelId === FREE_DEFAULT, `served=${unchosen.modelId}`);
  }

  section('5b compare is REACHABLE and METERED for a free user (per column)');
  {
    // The compare route lets a free user run any model, but spends ONE free message
    // per column via enforceSubscriptionGate. This asserts the same composition the
    // route performs: access is open, budget is the 10-message counter, and a
    // 3-model compare therefore costs 3.
    check('free user is allowed a frontier compare column', canUseModel('claude-sonnet-5', undefined));
    const uid = await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT - 3 });
    for (let i = 0; i < 3; i++) await enforceSubscriptionGate(uid, await read(uid)); // 3 columns
    check('a 3-model compare spent 3 free messages', (await read(uid)).freeMessagesUsed === FREE_MESSAGE_LIMIT,
      `freeMessagesUsed=${(await read(uid)).freeMessagesUsed}`);
    check('the next column is walled', (await enforceSubscriptionGate(uid, await read(uid))) !== null);
  }

  section('6  💸 what a free signup can actually cost — NOW WITH FRONTIER ACCESS');
  {
    check('history budget exceeds the per-message cap (or a paste is evicted next turn)',
      FREE_HISTORY_CHAR_BUDGET > FREE_MAX_MESSAGE_CHARS, `${FREE_HISTORY_CHAR_BUDGET} > ${FREE_MAX_MESSAGE_CHARS}`);

    // 🔑 Re-costed against the DEAREST model in the WHOLE catalog now, because a free
    // user can reach any of them, and at that model's FULL output cap (reasoning
    // models spend up to maxTokensFor on hidden thinking + answer). The 10-message
    // counter is the only bound — whether spent as chat turns or compare columns.
    const dearest = PLATFORM_MODELS.reduce((a, b) => estimatedCostUsd(b.id, 1e6) > estimatedCostUsd(a.id, 1e6) ? b : a);
    const SYSTEM_PROMPT_TOKENS = 5_300;   // measured, see chat/route.ts (compare's system is far smaller)
    const inputTokens = SYSTEM_PROMPT_TOKENS + (FREE_MAX_MESSAGE_CHARS + FREE_HISTORY_CHAR_BUDGET) / 4;
    const outputTokens = maxTokensFor(dearest.id); // the cap a reasoning model can actually spend
    const perMessageTokens = inputTokens + outputTokens;
    const worstTokens = perMessageTokens * FREE_MESSAGE_LIMIT;
    const worstUsd = estimatedCostUsd(dearest.id, worstTokens);
    console.log(`   dearest catalog model: ${dearest.id} ($${estimatedCostUsd(dearest.id, 1e6).toFixed(2)}/1M)`);
    console.log(`   worst case: ${FREE_MESSAGE_LIMIT} calls × ~${Math.round(perMessageTokens).toLocaleString()} tok (incl. ${outputTokens.toLocaleString()} output) = ${Math.round(worstTokens).toLocaleString()} tok → $${worstUsd.toFixed(2)} per signup`);
    console.log(`   ⚠️ AGGREGATE at scale: 1,000 signups → $${(worstUsd * 1000).toFixed(0)}   ·   10,000 signups → $${(worstUsd * 10000).toFixed(0)}`);
    console.log(`   (this is the ABSOLUTE worst — every free call maxes a frontier reasoning model. Typical cold signup sends 1-3 short messages, ~100x cheaper.)`);
    // Per-signup bound: metered frontier access, honestly costed. This is the ceiling
    // Jeremiah accepted when he chose "full frontier, make the promise true". If a
    // cheaper model is ever added that raises the dearest, this still holds; if the
    // ceiling is unacceptable at scale, the lever is an AGGREGATE free-inference cap,
    // not lowering maxTokens (reasoning models blank at low caps — model-params.ts).
    // ~$4 is the ACCEPTED per-signup ceiling for the metered-frontier free tier
    // (Jeremiah's "make the promise true" call). It is bounded and lifetime-capped
    // per uid — one account can never exceed it. Headroom to $5 so a slightly dearer
    // model or a costing tweak fails LOUDLY here rather than drifting. The aggregate
    // exposure (see the projection printed above) is a separate lever: cap it with a
    // GLOBAL monthly free-inference budget, never by lowering maxTokens.
    check('a free signup stays under $5 at its absolute worst', worstUsd < 5, `$${worstUsd.toFixed(2)}`);
  }

  section('7  the free tier has no token ceiling — and must not need one');
  {
    // enforcePaidTokenLimit no-ops for non-paid plans. That is CORRECT here only
    // because the message counter is the ceiling. If free ever gains a plan string
    // that isPaidPlan() accepts, this becomes an unbounded account.
    const uid = await freeUser({ windowTokens: MODUS_WINDOW_LIMIT * 100, windowStart: Date.now() });
    check('enforcePaidTokenLimit does not gate a free user (the message cap does)',
      enforcePaidTokenLimit(await read(uid)) === null);
    check('…and the message cap still stops them', (await enforceSubscriptionGate(
      await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT }), { freeMessagesUsed: FREE_MESSAGE_LIMIT },
    )) !== null);
  }

  section('8  fail CLOSED — a broken counter must not open the paywall');
  {
    // Not simulated: asserted structurally. The catch in enforceSubscriptionGate
    // sets allowed=false, so a Firestore outage denies rather than grants. The
    // opposite default would turn MODUS free the moment Firestore hiccuped.
    const src = readFileSync(resolve(process.cwd(), 'lib/chat/limits.ts'), 'utf8');
    const gate = src.slice(src.indexOf('export async function enforceSubscriptionGate'));
    check('the transaction is wrapped in try/catch', /catch\s*\(/.test(gate.slice(0, gate.indexOf('return Response.json'))));
    check('the catch denies rather than grants', /allowed\s*=\s*false/.test(gate));
    check('the increment is INSIDE runTransaction', gate.indexOf('runTransaction') < gate.indexOf('freeMessagesUsed: used + 1'));
    check('uses set({merge:true}), never update() — update() throws on a missing doc',
      /txn\.set\([^)]*\{ merge: true \}/.test(gate) && !/txn\.update\(/.test(gate));
  }

  section('9  LIFECYCLE — subscribe, cancel, come back');
  {
    // What billing.ts:186 actually writes when the last subscription ends.
    const CANCELLED = { plan: 'free', subscriptionId: null, limitAddonQty: 0 };

    check('a cancelled subscriber IS a free-tier user (soft landing, not a lockout)',
      isFreeTierUser(CANCELLED));
    check('…and hasActiveAccess correctly rejects them', !hasActiveAccess(CANCELLED));

    // Subscribing must not be reachable through the free branch, and must not
    // reset the counter — otherwise subscribe/cancel/repeat farms free messages.
    const sub = await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT });
    await adminDb.collection('users').doc(sub).set({ plan: 'modus' }, { merge: true });
    check('subscribing restores access even with the free counter spent',
      (await enforceSubscriptionGate(sub, await read(sub))) === null);
    check('subscribing does NOT reset freeMessagesUsed',
      (await read(sub)).freeMessagesUsed === FREE_MESSAGE_LIMIT);
    await adminDb.collection('users').doc(sub).set(CANCELLED, { merge: true });
    check('cancelling again does not hand back a fresh allowance',
      (await enforceSubscriptionGate(sub, await read(sub))) !== null);

    // 🔑 The counter is MONOTONIC, so the cycle is bounded no matter how it is
    // played: ten free messages per uid, for life.
    check('free messages are bounded at FREE_MESSAGE_LIMIT for life',
      ((await read(sub)).freeMessagesUsed as number) <= FREE_MESSAGE_LIMIT,
      `freeMessagesUsed=${(await read(sub)).freeMessagesUsed}`);

    // ⚠️ DOCUMENTED INCONSISTENCY, not a bug — asserted so it stays deliberate.
    // What a returning ex-customer gets depends on what they did BEFORE they ever
    // paid: someone who subscribed on day one gets a full 10 on cancelling, while
    // someone who tried the free tier first gets 0. Same customer, same
    // cancellation, different experience. Bounded and unexploitable, but arbitrary.
    const straightToPaid = await freeUser({ plan: 'modus' });
    await adminDb.collection('users').doc(straightToPaid).set(CANCELLED, { merge: true });
    const gotFree = (await enforceSubscriptionGate(straightToPaid, await read(straightToPaid))) === null;
    check('KNOWN: an ex-customer who never touched the free tier gets a full allowance on cancelling',
      gotFree, gotFree ? 'gets 10 — decide if that is the intended off-ramp' : 'gets 0');
  }

  section('10 💸 nothing else calls a model for a free user');
  {
    // The hole this closes: isBriefingDue was onboardingComplete + a capability
    // that DEFAULTS ON + the hour, with no plan check. Harmless while MODUS was
    // fully paid (a plan-less account could not finish onboarding); the free tier
    // removes exactly that barrier. Every free signup would then get a
    // model-calling briefing daily, forever, outside the ten-message cap.
    const hour = 7;
    const onboardedFree = { onboardingComplete: true, settings: { briefingHour: hour } };
    check('a free user is NOT due a daily briefing', !isBriefingDue(onboardedFree, hour));
    check('a paying user still is', isBriefingDue({ ...onboardedFree, plan: 'modus' }, hour));
    // Briefings are a PAID feature and cost a model call a day.
    // and must keep the feature.
    check('a PAID user still is', isBriefingDue({ ...onboardedFree, plan: 'modus' }, hour));
    check('a cancelled subscriber is not', !isBriefingDue({ ...onboardedFree, plan: 'free' }, hour));
  }

  console.log(failures === 0
    ? '\n✅ FREE TIER HOLDS — capped, raceproof, cheap, bounded across the billing lifecycle, and it fails closed.'
    : `\n❌ ${failures} FAILURE(S)`);
}

main()
  .catch(e => { console.error(e); failures++; })
  .finally(async () => {
    await Promise.all(temp.map(uid => adminDb.collection('users').doc(uid).delete().catch(() => {})));
    console.log(`\n🧹 cleaned up ${temp.length} temp users`);
    process.exit(failures === 0 ? 0 : 1);
  });
