'use client';

import { FREE_DAILY_LIMIT, MODUS_TOKEN_LIMIT, PILOT_TOKEN_LIMIT, MODUS_WEEKLY_LIMIT, PILOT_WEEKLY_LIMIT } from '@/lib/constants';
import { isPaidPlan, isPilotLevelPlan } from '@/lib/plan';

interface Props {
  plan: 'free' | 'modus' | 'pilot' | 'group';
  usage: {
    dailyMessages: number; usageDate: string;
    dailyTokens: number;   tokenDate: string;
    weeklyTokens: number;  tokenWeek: string;
  };
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-brand'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

export default function UsageSettings({ plan, usage, onUpgrade }: Props & { onUpgrade?: () => void }) {
  const isPaid = isPaidPlan(plan);
  const today   = new Date().toISOString().slice(0, 10);
  const weekKey = getWeekKey();

  const dailyLimit  = isPilotLevelPlan(plan) ? PILOT_TOKEN_LIMIT  : MODUS_TOKEN_LIMIT;
  const weeklyLimit = isPilotLevelPlan(plan) ? PILOT_WEEKLY_LIMIT : MODUS_WEEKLY_LIMIT;

  const dailyCount   = usage.usageDate === today    ? usage.dailyMessages  : 0;
  const tokenCount   = usage.tokenDate === today    ? usage.dailyTokens    : 0;
  const weeklyCount  = usage.tokenWeek === weekKey  ? usage.weeklyTokens   : 0;

  const dailyPct   = Math.min(100, (tokenCount  / dailyLimit)  * 100);
  const weeklyPct  = Math.min(100, (weeklyCount / weeklyLimit) * 100);

  const resetTime = (() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();

  const nextMonday = (() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  })();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Usage</h2>
        <p className="text-sm text-muted">Track your AI usage and plan limits.</p>
      </div>

      {isPaid ? (
        <>
          {/* Daily usage */}
          <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-text">Today</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-brand">{dailyPct.toFixed(1)}%</p>
                <p className="text-xs text-muted">used today</p>
              </div>
              <UsageBar value={tokenCount} max={dailyLimit} />
              <div className="flex justify-between text-xs text-muted">
                <span>{tokenCount.toLocaleString()} of {dailyLimit.toLocaleString()} tokens</span>
                <span>Resets in {resetTime}</span>
              </div>
            </div>
          </div>

          {/* Weekly usage */}
          <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-text">This Week</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-brand">{weeklyPct.toFixed(1)}%</p>
                <p className="text-xs text-muted">used this week</p>
              </div>
              <UsageBar value={weeklyCount} max={weeklyLimit} />
              <div className="flex justify-between text-xs text-muted">
                <span>{weeklyCount.toLocaleString()} of {weeklyLimit.toLocaleString()} tokens</span>
                <span>Resets {nextMonday}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Free user — message count */
        <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-text">Daily Messages</h3>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-text">{dailyCount}</p>
              <p className="text-sm text-muted">/ {FREE_DAILY_LIMIT}</p>
            </div>
            <UsageBar value={dailyCount} max={FREE_DAILY_LIMIT} />
            <div className="flex justify-between text-xs text-muted">
              <span>{FREE_DAILY_LIMIT - dailyCount} messages remaining today</span>
              <span>Resets in {resetTime}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plan limits */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Plan Limits</h3>
        <div className="space-y-3">
          {(isPaid ? [
            { label: 'Daily AI tokens',   value: `${dailyLimit.toLocaleString()}/day` },
            { label: 'Weekly AI tokens',  value: `${weeklyLimit.toLocaleString()}/week` },
            { label: 'Goals / Tasks / Habits', value: 'Unlimited' },
            { label: 'Memory storage',    value: 'Unlimited' },
            { label: 'Data retention',    value: '2 years' },
          ] : [
            { label: 'Daily messages',    value: `${FREE_DAILY_LIMIT}/day (after trial)` },
            { label: 'Goals / Tasks / Habits', value: 'Unlimited' },
            { label: 'Memory storage',    value: '50 memories' },
            { label: 'Data retention',    value: '90 days' },
          ]).map(row => (
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted">{row.label}</span>
              <span className="text-sm text-text font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {!isPaid && (
        <div className="bg-brand/10 border border-brand/30 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text mb-1">Unlock unlimited messages</p>
            <p className="text-xs text-muted">Upgrade to MODUS for $24/mo — no daily caps, full memory, daily briefings.</p>
          </div>
          <button
            onClick={onUpgrade}
            className="shrink-0 px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
