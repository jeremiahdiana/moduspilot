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
  if (!userCapabilityEnabled(userData, 'dailyBriefing')) return false;
  return briefingHour(userData) === utcHour;
}
