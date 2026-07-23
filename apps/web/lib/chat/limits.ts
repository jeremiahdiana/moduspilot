import { createHash } from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  GUEST_DAILY_LIMIT,
  PAYWALL_LAUNCH_MS,
  MODUS_TOKEN_LIMIT,
  PILOT_TOKEN_LIMIT,
  MODUS_WEEKLY_LIMIT,
  PILOT_WEEKLY_LIMIT,
} from '@/lib/constants';
import { hasActiveAccess, isPaidPlan, isPilotLevelPlan } from '@/lib/plan';

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
 * Subscription gate. MODUS is fully paid: access requires a paid/trialing
 * subscription (plan set by the Stripe webhook, including the 3-day card-required
 * trial) OR being grandfathered. Accounts created before PAYWALL_LAUNCH_MS are
 * grandfathered into permanent free access; the flag is resolved once (from the
 * Firebase account creation time) and cached on the user doc. Everyone else must
 * start a trial — blocked with a 402 so the client can open checkout.
 * Returns a Response when blocked, otherwise null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enforceSubscriptionGate(uid: string, userData: Record<string, any>): Promise<Response | null> {
  // Fast path: subscribed/trialing or already-known grandfathered.
  if (hasActiveAccess(userData)) return null;

  // Resolve grandfather status once if unknown, then cache it on the user doc.
  if (userData.grandfathered === undefined) {
    let createdMs = PAYWALL_LAUNCH_MS; // if we can't tell, don't grandfather
    try {
      const rec = await adminAuth.getUser(uid);
      const created = rec.metadata?.creationTime;
      if (created) createdMs = new Date(created).getTime();
    } catch {
      // Fall back to modusPilotSignupAt if the auth lookup fails.
      const raw = userData.modusPilotSignupAt;
      if (raw) createdMs = typeof raw.toDate === 'function' ? raw.toDate().getTime() : new Date(raw as string).getTime();
    }
    const grandfathered = createdMs < PAYWALL_LAUNCH_MS;
    userData.grandfathered = grandfathered;
    adminDb.collection('users').doc(uid).set({ grandfathered }, { merge: true }).catch(() => {});
    if (grandfathered) return null;
  }

  // New user, no subscription — must start a trial.
  return Response.json({ error: 'subscription_required' }, { status: 402 });
}

/**
 * Paid daily + weekly token ceilings. Non-paid plans are a no-op.
 * Returns a 429 Response when over budget, otherwise null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enforcePaidTokenLimit(userData: Record<string, any>): Response | null {
  const plan = userData.plan as string | undefined;
  if (!isPaidPlan(plan)) return null;
  const todayStr  = new Date().toISOString().slice(0, 10);
  const weekKey   = getWeekKey();
  const dailyLimit  = isPilotLevelPlan(plan) ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT;
  const weeklyLimit = isPilotLevelPlan(plan) ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT;
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
  const dailyLimit  = isPilotLevelPlan(plan) ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT;
  const weeklyLimit = isPilotLevelPlan(plan) ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT;
  const tokensToday = (userData.tokenDate as string) === todayStr ? ((userData.dailyTokens  as number) ?? 0) : 0;
  const tokensWeek  = (userData.tokenWeek as string) === weekKey  ? ((userData.weeklyTokens as number) ?? 0) : 0;
  const worst = Math.max(tokensToday / dailyLimit, tokensWeek / weeklyLimit);
  if (!Number.isFinite(worst)) return null;
  return Math.max(0, Math.min(100, Math.round(worst * 100)));
}

/**
 * Track token usage for paid users (fire-and-forget). No-op for free plans.
 * Increments daily + weekly counters atomically, resetting on date/week roll.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trackTokenUsage(uid: string, userData: Record<string, any>, totalTokens: number): void {
  const plan = userData.plan as string | undefined;
  if (!isPaidPlan(plan)) return;
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
