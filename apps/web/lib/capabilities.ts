// Single source of truth for capability defaults — the same role lib/plan.ts
// plays for plan gates, for the same reason.
//
// A capability read with one default on the client and a different one (or none)
// on the server is a toggle that lies. That is not hypothetical: the daily
// briefing shipped for weeks with Settings showing OFF while the cron delivered
// one every morning, because onboarding wrote `dailyBriefing: false`, three
// client readers defaulted it ON, and the cron never read the flag at all.
//
// hooks/useUserSettings.ts is 'use client', so server routes cannot import its
// DEFAULT_SETTINGS — that split is how the two sides drifted apart in the first
// place. Both import this module instead. Keep it free of server/client deps.
//
// lib/plan.ts is the one import allowed here: it is client-safe by design (see
// its header) for exactly this reason — a gate has to read the same on both sides.
import { hasActiveAccess } from '@/lib/plan';

export type CapabilityKey =
  | 'dailyBriefing'
  | 'voiceInput'
  | 'vectorMemory'
  | 'webSearch'
  | 'inboxTriage'
  | 'relationshipNurture'
  | 'notesSync'
  | 'messagesSync';

/** What a capability means when the user doc doesn't say. */
export const CAPABILITY_DEFAULTS: Record<CapabilityKey, boolean> = {
  dailyBriefing: true,
  voiceInput: false,
  vectorMemory: false,
  webSearch: false,
  inboxTriage: true,
  relationshipNurture: true,
  notesSync: true,
  messagesSync: false,
};

export function capabilityEnabled(
  caps: Partial<Record<CapabilityKey, boolean>> | undefined | null,
  key: CapabilityKey,
): boolean {
  return caps?.[key] ?? CAPABILITY_DEFAULTS[key];
}

/** Read a capability straight off a Firestore user doc (server side). */
export function userCapabilityEnabled(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: Record<string, any> | null | undefined,
  key: CapabilityKey,
): boolean {
  return capabilityEnabled(userData?.settings?.capabilities, key);
}

/** UTC hour the briefing fires for this user. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function briefingHour(userData: Record<string, any> | null | undefined): number {
  return userData?.settings?.briefingHour ?? 7;
}

/**
 * Whether this user should receive a briefing on this UTC hour's cron tick.
 *
 * Lives here rather than inline in the cron because a Next.js route file can
 * only export handlers — an inline filter is untestable, and an untestable
 * filter is what silently ignored the off switch. Filtering happens in memory,
 * not in the Firestore query: a doc with no capabilities map must still get a
 * briefing (the default is ON), and a `where` on a missing nested field matches
 * nothing at all.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBriefingDue(userData: Record<string, any> | null | undefined, utcHour: number): boolean {
  if (userData?.onboardingComplete !== true) return false;
  // 💸 PLAN GATE, added with the free tier 2026-08-04. Without it this filter was
  // onboardingComplete + a capability that DEFAULTS TO ON + the hour — and no
  // check on whether the account pays. That was harmless while MODUS was fully
  // paid, because an account with no subscription could not get far enough to
  // finish onboarding. The free tier removes exactly that barrier.
  //
  // The hole it would have opened: every free signup who completes onboarding
  // gets a daily briefing that calls a model (generateBriefingData → generateText)
  // FOREVER, outside the ten-message cap and outside every counter that bounds it.
  // That turns "a free signup costs $0.074 once" into "$0.074 plus a model call a
  // day, indefinitely" — the free tier's whole costing, quietly wrong.
  //
  // 🪤 hasActiveAccess, NOT isPaidPlan. Grandfathered accounts have no `plan`
  // string, so gating on isPaidPlan would silently switch briefings off for every
  // pre-paywall user — taking a feature away from the people least likely to
  // forgive it.
  if (!hasActiveAccess(userData)) return false;
  if (!userCapabilityEnabled(userData, 'dailyBriefing')) return false;
  return briefingHour(userData) === utcHour;
}
