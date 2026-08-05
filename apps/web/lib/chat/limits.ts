import { createHash } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GUEST_DAILY_LIMIT, FREE_MESSAGE_LIMIT } from '@/lib/constants';
import { hasActiveAccess, isPaidPlan, planCeilings } from '@/lib/plan';
import { weightedTokens } from '@/lib/chat/model-cost';

/**
 * Is this a free-tier account — signed in, with no subscription?
 *
 * Deliberately "not paid" rather than plan === 'free': the
 * Stripe webhook never writes 'free', so a free-tier user's `plan` is simply
 * absent. Checking for the string would silently match nobody, which is the kind
 * of gate that looks enforced and is not.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFreeTierUser(userData: Record<string, any> | null | undefined): boolean {
  if (!userData) return false;
  return !isPaidPlan(userData.plan as string | undefined);
}

/** ISO date (YYYY-MM-DD) of the Monday that starts the current UTC week. */
export function getWeekKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

/**
 * Guest rate limit — GUEST_DAILY_LIMIT messages per day per IP (unauthenticated).
 * Atomic transaction prevents concurrent-request bypass.
 * Returns a 429 Response when blocked, otherwise null.
 */
export async function enforceGuestRateLimit(req: Request): Promise<Response | null> {
  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown')
    .split(',')[0].trim();
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const todayStr = new Date().toISOString().slice(0, 10);
  const guestRef = adminDb.collection('guestRateLimits').doc(ipHash);
  let guestBlocked = false;
  await adminDb.runTransaction(async (txn) => {
    const snap = await txn.get(guestRef);
    const data = snap.data() ?? {};
    const count = (data.date as string) === todayStr ? ((data.count as number) ?? 0) : 0;
    if (count >= GUEST_DAILY_LIMIT) { guestBlocked = true; return; }
    txn.set(guestRef, { count: count + 1, date: todayStr });
  });
  return guestBlocked ? Response.json({ error: 'guest_limit_reached' }, { status: 429 }) : null;
}

/**
 * Subscription gate, in the order access is granted:
 *
 *   1. paid/trialing subscription (plan set by the Stripe webhook, including the
 *      3-day card-required trial) — hasActiveAccess
 *   2. the free taste tier: FREE_MESSAGE_LIMIT messages, lifetime, per uid
 *   3. otherwise 402
 *
 * 🗑️ There used to be a step between 1 and 2: any account created before
 * PAYWALL_LAUNCH_MS got permanent free access, resolved from its Firebase signup
 * date. **Jeremiah never made that rule** — an earlier session invented it, and its
 * name (`grandfathered`, later `preLaunchAccess`) kept being confused with
 * moduspilot.com/grandfathering, which is the opposite: founding members who PAY
 * $24/mo. Deleted 2026-08-06. Signup date now entitles you to nothing.
 *
 * ⚠️ MODUS IS NO LONGER "fully paid", which this comment used to assert and a
 * caller might still assume. Step 3 was added 2026-08-04. `plan` is undefined for
 * a free-tier user, so anything keying off isPaidPlan() — enforcePaidTokenLimit,
 * trackTokenUsage, planCeilings — treats them as unlimited unless it says
 * otherwise. Each has been given an explicit free-tier branch; a NEW caller that
 * gates on isPaidPlan() has to decide the same thing consciously.
 *
 * Returns a Response when blocked, otherwise null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enforceSubscriptionGate(uid: string, userData: Record<string, any>): Promise<Response | null> {
  // Fast path: subscribed or trialing. That is the only thing that skips the tier.
  if (hasActiveAccess(userData)) return null;

  // ── The free taste tier ────────────────────────────────────────────────────
  //
  // 🧊 WHY THIS EXISTS. Before it, a stranger had to enter a card to send ONE
  // message, and cold traffic converted at approximately zero — every paying
  // account to date came from a warm personal invite. Nothing about distribution
  // works while the first thing a visitor meets is a payment form, so the first
  // FREE_MESSAGE_LIMIT messages are free. Sign-in is still required (there is an
  // email to follow up with, and the cap is per-uid rather than per-IP, which a
  // VPN or an incognito window defeats).
  //
  // 🔒 THE INCREMENT MUST BE INSIDE THE TRANSACTION. Read-then-write outside one
  // lets N concurrent requests all observe the same count and all pass — the exact
  // bypass enforceGuestRateLimit above is written in this shape to prevent. Free
  // messages are the one counter a stranger has an incentive to race.
  //
  // 💸 Cost is bounded by FREE_MESSAGE_LIMIT × FREE_MAX_MESSAGE_CHARS on the two
  // cheapest models in the catalog — see the costing in lib/constants.ts.
  //
  // Free-reachable means plans:['free', …] in PLATFORM_MODELS, which today is
  // gemini-3.5-flash-lite ($0.52/1M, the FREE_DEFAULT) and meta/llama-3.3-70b
  // ($0.60/1M). Dropping 'free' from a catalog row to tighten this tier takes that
  // model away from every free account, so re-cost before touching it.
  // verify-free-tier.ts §5 costs whichever free-reachable model is dearest, so
  // adding a third one cannot quietly invalidate the arithmetic above.
  const userRef = adminDb.collection('users').doc(uid);
  let allowed = false;
  try {
    await adminDb.runTransaction(async (txn) => {
      // 🪤 RESET ON EVERY ATTEMPT. Firestore RETRIES a contended transaction, so
      // this callback can run more than once — and `allowed` lives outside it.
      // Without this line an attempt that saw room set allowed=true, then the
      // retry that hit the cap returned early and left that stale `true` behind:
      // caught by verify-free-tier.ts §3, where 9 of 12 concurrent requests were
      // waved through on a counter that correctly said 10. The counter was never
      // wrong; the ANSWER was. A transaction protects the write, not your closure.
      allowed = false;
      const snap = await txn.get(userRef);
      const used = (snap.data()?.freeMessagesUsed as number) ?? 0;
      if (used >= FREE_MESSAGE_LIMIT) return;
      // 🪤 set({merge:true}), NOT update(): a user can reach the chat before
      // onboarding has created their doc, and update() THROWS on a missing
      // document. That is not hypothetical — it is how a real $24 payer ended up
      // with no plan (see repair-subscription.ts).
      txn.set(userRef, { freeMessagesUsed: used + 1 }, { merge: true });
      allowed = true;
    });
  } catch (e) {
    // Fail CLOSED. A Firestore outage must not turn the paywall off.
    console.error('[chat] free-tier counter failed:', e);
    allowed = false;
  }
  if (allowed) return null;

  // Free messages spent, or never eligible — must subscribe. Distinct code from
  // 'subscription_required' so the client can say "you've used your 10 free
  // messages" rather than "start your trial", which reads as a broken loop to
  // someone who has already been using the product.
  return Response.json({ error: 'free_limit_reached' }, { status: 402 });
}

/**
 * Paid daily + weekly token ceilings. Non-paid plans are a no-op.
 * Returns a 429 Response when over budget, otherwise null.
 *
 * Ceilings come from planCeilings() so a purchased add-on raises the gate and the
 * meter by the same amount — see lib/plan.ts for why that is not computed here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enforcePaidTokenLimit(userData: Record<string, any>): Response | null {
  const plan = userData.plan as string | undefined;
  // Only paid plans have a ceiling to enforce. Free-tier accounts are bounded by
  // the MESSAGE cap in enforceSubscriptionGate instead, which is the thing that
  // actually stops them, and they can only reach the two cheapest models anyway.
  if (!isPaidPlan(plan)) return null;
  const todayStr  = new Date().toISOString().slice(0, 10);
  const weekKey   = getWeekKey();
  const { daily: dailyLimit, weekly: weeklyLimit } = planCeilings(userData);
  const tokensToday  = (userData.tokenDate  as string) === todayStr ? ((userData.dailyTokens  as number) ?? 0) : 0;
  const tokensWeek   = (userData.tokenWeek  as string) === weekKey  ? ((userData.weeklyTokens as number) ?? 0) : 0;
  if (tokensToday >= dailyLimit || tokensWeek >= weeklyLimit) {
    return Response.json({ error: 'token_limit_reached' }, { status: 429 });
  }
  return null;
}

/**
 * How much of the plan's ceiling this account has consumed, 0–100.
 *
 * Takes the HIGHER of the daily and weekly figures, because whichever will stop
 * the user first is the only one worth showing them — reporting 20% of the week
 * while the day is at 95% would be true and useless.
 *
 * Returns null where no ceiling applies (guests, free, unpaid): a percentage of
 * a limit that does not exist is worse than showing nothing.
 *
 * ⏱️ Computed BEFORE the answer streams, from the counters as they stand at the
 * start of the request — so it excludes the message being sent right now. It is
 * a "where you stand" figure, not a live meter, which is what makes it stable
 * enough to show without flickering mid-stream.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usagePercent(userData: Record<string, any>): number | null {
  const plan = userData.plan as string | undefined;
  if (!isPaidPlan(plan)) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekKey = getWeekKey();
  const { daily: dailyLimit, weekly: weeklyLimit } = planCeilings(userData);
  const tokensToday = (userData.tokenDate as string) === todayStr ? ((userData.dailyTokens  as number) ?? 0) : 0;
  const tokensWeek  = (userData.tokenWeek as string) === weekKey  ? ((userData.weeklyTokens as number) ?? 0) : 0;
  const worst = Math.max(tokensToday / dailyLimit, tokensWeek / weeklyLimit);
  if (!Number.isFinite(worst)) return null;
  // 🪤 100% MEANS BLOCKED, AND ONLY BLOCKED.
  //
  // This used to be a plain Math.round, so 499,999 of a 500,000 ceiling rounded
  // to 100% — the meter told people they were out of usage while
  // enforcePaidTokenLimit was still happily serving them. Reporting "you have
  // nothing left" to someone who does is the same failure as the 27x billing bug,
  // just cheaper: the number shown and the number enforced disagreed.
  //
  // Capping at 99 until `worst` actually reaches 1 makes the two agree by
  // construction, and scripts/verify-limit-addon.ts pins it at every quantity.
  if (worst >= 1) return 100;
  return Math.max(0, Math.min(99, Math.round(worst * 100)));
}

/**
 * Track token usage for paid users (fire-and-forget). No-op for free plans.
 * Increments daily + weekly counters atomically, resetting on date/week roll.
 *
 * 🚨 `modelId` IS REQUIRED AND THE WEIGHTING HAPPENS IN HERE, ON PURPOSE.
 *
 * The counters store COST UNITS, not raw tokens: one Claude Fable 5 token is ~24
 * Llama 3.3 tokens of spend, and before this the ceiling treated them as equal, so
 * it bounded token count while bounding nothing about the bill. See
 * lib/chat/model-cost.ts for the measured exposure.
 *
 * Doing the multiply at the call site instead would mean every future call site
 * has to remember, and the one that forgets is invisible: usage still increments,
 * the limit still appears enforced, and the model is served at a loss. Taking the
 * model id as a required argument makes that mistake a type error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trackTokenUsage(uid: string, userData: Record<string, any>, rawTokens: number, modelId: string): void {
  const plan = userData.plan as string | undefined;
  // Record for paid plans AND for the free tier. Free users are capped by message
  // count, not by tokens, so this does not gate anything for them — but without it
  // free usage was invisible, and "what does a free signup actually cost" could
  // only ever be answered with the arithmetic in lib/constants.ts rather than with
  // a real number. PreLaunchAccess accounts stay unmetered, as they always were.
  if (!isPaidPlan(plan) && !isFreeTierUser(userData)) return;
  const totalTokens = weightedTokens(modelId, rawTokens);
  if (totalTokens <= 0) return;
  const userRef = adminDb.collection('users').doc(uid);
  adminDb.runTransaction(async (txn) => {
    const snap = await txn.get(userRef);
    const data = snap.data() ?? {};
    const todayStr   = new Date().toISOString().slice(0, 10);
    const weekKey    = getWeekKey();
    const isToday    = (data.tokenDate  as string) === todayStr;
    const isThisWeek = (data.tokenWeek  as string) === weekKey;
    txn.set(userRef, {
      dailyTokens:  isToday    ? FieldValue.increment(totalTokens) : totalTokens,
      tokenDate:    todayStr,
      weeklyTokens: isThisWeek ? FieldValue.increment(totalTokens) : totalTokens,
      tokenWeek:    weekKey,
    }, { merge: true });
  }).catch(e => console.error('[chat] token increment failed:', e));
}
