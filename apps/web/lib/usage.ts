import { WINDOW_MS } from '@/lib/constants';

export function getUsageWeekKey(now = Date.now()): string {
  const monday = new Date(now);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

export function usageSnapshot(usage: { windowStart: number; windowTokens: number; tokenWeek: string; weeklyTokens: number }, now = Date.now()) {
  const live = usage.windowStart > 0 && now < usage.windowStart + WINDOW_MS;
  const count = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
  return {
    windowCount: live ? count(usage.windowTokens) : 0,
    weeklyCount: usage.tokenWeek === getUsageWeekKey(now) ? count(usage.weeklyTokens) : 0,
    windowReset: live ? usage.windowStart + WINDOW_MS : null,
    weekReset: Date.parse(`${getUsageWeekKey(now)}T00:00:00Z`) + 7 * 24 * 60 * 60 * 1000,
  };
}

export function allowancePercent(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return value >= max ? 100 : Math.max(0, Math.min(99.9, Math.floor(value / max * 1000) / 10));
}
