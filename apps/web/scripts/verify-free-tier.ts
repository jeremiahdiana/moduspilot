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
import { FREE_MESSAGE_LIMIT, FREE_MAX_MESSAGE_CHARS, FREE_HISTORY_CHAR_BUDGET, MODUS_TOKEN_LIMIT } from '../lib/constants';
import { FREE_DEFAULT, resolveChatModel } from '../lib/chat/model';
import { PLATFORM_MODELS, isModelUnlocked } from '../lib/models';
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
  // grandfathered:false pinned explicitly so the gate does not go and resolve it
  // from a Firebase auth record that does not exist for a synthetic uid.
  await adminDb.collection('users').doc(uid).set({ grandfathered: false, ...overrides });
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

  section('4  paid + grandfathered accounts are untouched by any of this');
  {
    const paid = await freeUser({ plan: 'modus' });
    check('a paying user is never charged a free message',
      (await enforceSubscriptionGate(paid, await read(paid))) === null && (await read(paid)).freeMessagesUsed === undefined,
      `freeMessagesUsed=${(await read(paid)).freeMessagesUsed}`);
    check('isFreeTierUser is false for a paid plan', !isFreeTierUser({ plan: 'modus' }));

    const gf = await freeUser({ grandfathered: true });
    check('a grandfathered user is never charged a free message',
      (await enforceSubscriptionGate(gf, await read(gf))) === null && (await read(gf)).freeMessagesUsed === undefined);
    check('isFreeTierUser is false for grandfathered', !isFreeTierUser({ grandfathered: true }));

    // The one that would silently match nobody: the Stripe webhook never writes
    // plan:'free', so a free user's plan is ABSENT, not the string 'free'.
    check('isFreeTierUser is true when plan is simply absent', isFreeTierUser({ grandfathered: false }));
  }

  section('5  a free user cannot reach a model that costs more than the costing');
  {
    const freeModels = PLATFORM_MODELS.filter(m => m.plans.includes('free'));
    check('FREE_DEFAULT is unlocked for the free plan', isModelUnlocked(FREE_DEFAULT, 'free'), FREE_DEFAULT);
    // ⚠️ 'free' also covers GRANDFATHERED accounts (no plan string → effectivePlan
    // 'free'), which is why this asserts a price ceiling rather than demanding the
    // list contain only FREE_DEFAULT. The bound is what the costing in §6 can
    // absorb, so a cheap addition passes and an expensive one fails loudly.
    for (const m of freeModels) {
      const usd = estimatedCostUsd(m.id, 1_000_000);
      check(`free-reachable model stays under $0.65/1M: ${m.id}`, usd <= 0.65,
        `weight=${costWeight(m.id)} $${usd.toFixed(2)}/1M`);
    }
    // The expensive twin. These two ids differ by one word and 4.3x in price, and
    // having Flash-Lite's rates filed under Flash's id is the bug that made this
    // whole change necessary.
    check('gemini-3.5-flash is NOT reachable on free', !isModelUnlocked('gemini-3.5-flash', 'free'));
    check('gemini-3.5-flash is priced above flash-lite',
      estimatedCostUsd('gemini-3.5-flash', 1_000_000) > estimatedCostUsd('gemini-3.5-flash-lite', 1_000_000) * 4,
      `$${estimatedCostUsd('gemini-3.5-flash', 1_000_000).toFixed(2)} vs $${estimatedCostUsd('gemini-3.5-flash-lite', 1_000_000).toFixed(2)} per 1M`);

    // A free user who picks a locked model must land on FREE_DEFAULT, not be served
    // the model they picked and not be dropped to a raw dead id.
    const picked = resolveChatModel({ plan: undefined, settings: { modelSettings: { provider: 'platform', model: 'claude-fable-5' } } }, {});
    check('free user picking Fable 5 is downgraded to FREE_DEFAULT', picked.modelId === FREE_DEFAULT, `served=${picked.modelId}`);
    const unchosen = resolveChatModel({ plan: undefined }, {});
    check('free user with no saved Brain gets FREE_DEFAULT', unchosen.modelId === FREE_DEFAULT, `served=${unchosen.modelId}`);
  }

  section('6  💸 what a free signup can actually cost');
  {
    // The number that makes this tier safe to ship. A message limit alone bounds
    // nothing unless the message itself is bounded — at the PAID 100k-char cap the
    // same 10 messages would be ~3x this.
    check('history budget exceeds the per-message cap (or a paste is evicted next turn)',
      FREE_HISTORY_CHAR_BUDGET > FREE_MAX_MESSAGE_CHARS, `${FREE_HISTORY_CHAR_BUDGET} > ${FREE_MAX_MESSAGE_CHARS}`);

    // 🔑 Costed against the DEAREST model a free user can reach, not FREE_DEFAULT.
    // Costing the default would be optimistic by construction — the user picks.
    const dearest = PLATFORM_MODELS
      .filter(m => m.plans.includes('free'))
      .reduce((a, b) => estimatedCostUsd(b.id, 1e6) > estimatedCostUsd(a.id, 1e6) ? b : a);
    const SYSTEM_PROMPT_TOKENS = 5_300;   // measured, see chat/route.ts
    const perMessageTokens = SYSTEM_PROMPT_TOKENS + (FREE_MAX_MESSAGE_CHARS + FREE_HISTORY_CHAR_BUDGET) / 4;
    const worstTokens = perMessageTokens * FREE_MESSAGE_LIMIT;
    const worstUsd = estimatedCostUsd(dearest.id, worstTokens);
    console.log(`   dearest free-reachable model: ${dearest.id} ($${estimatedCostUsd(dearest.id, 1e6).toFixed(2)}/1M)`);
    console.log(`   worst case: ${FREE_MESSAGE_LIMIT} msgs × ~${Math.round(perMessageTokens).toLocaleString()} tok = ${Math.round(worstTokens).toLocaleString()} tok → $${worstUsd.toFixed(3)} per signup`);
    console.log(`   1,000 signups → $${(worstUsd * 1000).toFixed(0)}   ·   10,000 signups → $${(worstUsd * 10000).toFixed(0)}`);
    check('a free signup costs under $0.25 at its absolute worst', worstUsd < 0.25, `$${worstUsd.toFixed(3)}`);
    check('10,000 free signups cost less than one month of MODUS revenue at 100 users',
      worstUsd * 10_000 < 2_400, `$${(worstUsd * 10_000).toFixed(0)}`);
  }

  section('7  the free tier has no token ceiling — and must not need one');
  {
    // enforcePaidTokenLimit no-ops for non-paid plans. That is CORRECT here only
    // because the message counter is the ceiling. If free ever gains a plan string
    // that isPaidPlan() accepts, this becomes an unbounded account.
    const uid = await freeUser({ dailyTokens: MODUS_TOKEN_LIMIT * 100, tokenDate: new Date().toISOString().slice(0, 10) });
    check('enforcePaidTokenLimit does not gate a free user (the message cap does)',
      enforcePaidTokenLimit(await read(uid)) === null);
    check('…and the message cap still stops them', (await enforceSubscriptionGate(
      await freeUser({ freeMessagesUsed: FREE_MESSAGE_LIMIT }), { grandfathered: false, freeMessagesUsed: FREE_MESSAGE_LIMIT },
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

  console.log(failures === 0
    ? '\n✅ FREE TIER HOLDS — capped, raceproof, cheap, and it fails closed.'
    : `\n❌ ${failures} FAILURE(S)`);
}

main()
  .catch(e => { console.error(e); failures++; })
  .finally(async () => {
    await Promise.all(temp.map(uid => adminDb.collection('users').doc(uid).delete().catch(() => {})));
    console.log(`\n🧹 cleaned up ${temp.length} temp users`);
    process.exit(failures === 0 ? 0 : 1);
  });
