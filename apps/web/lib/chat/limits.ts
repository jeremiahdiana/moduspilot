import { createHash } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  FREE_DAILY_LIMIT,
  GUEST_DAILY_LIMIT,
  TRIAL_MS,
  MODUS_TOKEN_LIMIT,
  PILOT_TOKEN_LIMIT,
  MODUS_WEEKLY_LIMIT,
  PILOT_WEEKLY_LIMIT,
} from '@/lib/constants';

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
 * Free-tier daily message limit. Paid plans are exempt. Trial users (within
 * TRIAL_MS of modusPilotSignupAt) are exempt; first-seen users have their
 * signup timestamp recorded and are granted the trial. Outside the trial,
 * FREE_DAILY_LIMIT messages/day enforced atomically.
 * Returns a 429 Response when blocked, otherwise null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enforceFreeTierLimit(uid: string, userData: Record<string, any>): Promise<Response | null> {
  const plan = userData.plan as string | undefined;
  const isPaid = plan === 'modus' || plan === 'pilot';
  if (isPaid) return null;

  // Use modusPilotSignupAt for trial — more reliable than Firebase Auth creation time.
  // If missing (existing users), set it now so their 30-day trial starts from today.
  let inTrial = false;
  const rawSignup = userData.modusPilotSignupAt;
  if (rawSignup) {
    const signupMs = typeof rawSignup.toDate === 'function'
      ? rawSignup.toDate().getTime()
      : new Date(rawSignup as string).getTime();
    inTrial = Date.now() - signupMs < TRIAL_MS;
  } else {
    // First time — record signup date and grant full trial
    adminDb.collection('users').doc(uid).set(
      { modusPilotSignupAt: FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(() => {});
    inTrial = true;
  }

  if (inTrial) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const userRef = adminDb.collection('users').doc(uid);
  let limitReached = false;
  await adminDb.runTransaction(async (txn) => {
    const snap = await txn.get(userRef);
    const data = snap.data() ?? {};
    const usageDate = (data.usageDate as string) ?? '';
    const dailyMessages = (data.dailyMessages as number) ?? 0;
    const count = usageDate === todayStr ? dailyMessages : 0;
    if (count >= FREE_DAILY_LIMIT) { limitReached = true; return; }
    if (usageDate === todayStr) {
      txn.set(userRef, { dailyMessages: FieldValue.increment(1) }, { merge: true });
    } else {
      txn.set(userRef, { dailyMessages: 1, usageDate: todayStr }, { merge: true });
    }
  });
  return limitReached ? Response.json({ error: 'daily_limit_reached' }, { status: 429 }) : null;
}

/**
 * Paid daily + weekly token ceilings. Non-paid plans are a no-op.
 * Returns a 429 Response when over budget, otherwise null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enforcePaidTokenLimit(userData: Record<string, any>): Response | null {
  const plan = userData.plan as string | undefined;
  if (plan !== 'modus' && plan !== 'pilot') return null;
  const todayStr  = new Date().toISOString().slice(0, 10);
  const weekKey   = getWeekKey();
  const dailyLimit  = plan === 'pilot' ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT;
  const weeklyLimit = plan === 'pilot' ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT;
  const tokensToday  = (userData.tokenDate  as string) === todayStr ? ((userData.dailyTokens  as number) ?? 0) : 0;
  const tokensWeek   = (userData.tokenWeek  as string) === weekKey  ? ((userData.weeklyTokens as number) ?? 0) : 0;
  if (tokensToday >= dailyLimit || tokensWeek >= weeklyLimit) {
    return Response.json({ error: 'token_limit_reached' }, { status: 429 });
  }
  return null;
}

/**
 * Track token usage for paid users (fire-and-forget). No-op for free plans.
 * Increments daily + weekly counters atomically, resetting on date/week roll.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trackTokenUsage(uid: string, userData: Record<string, any>, totalTokens: number): void {
  const plan = userData.plan as string | undefined;
  if (plan !== 'modus' && plan !== 'pilot') return;
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
