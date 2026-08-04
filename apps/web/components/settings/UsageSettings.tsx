'use client';

import { isPaidPlan, planCeilings } from '@/lib/plan';

interface Props {
  plan: 'free' | 'modus' | 'pilot' | 'group';
  usage: {
    dailyMessages: number; usageDate: string;
    dailyTokens: number;   tokenDate: string;
    weeklyTokens: number;  tokenWeek: string;
    /** Purchased limit add-ons. Raises the ceilings below — see planCeilings. */
    limitAddonQty?: number;
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

// Must match the server's getWeekKey (lib/chat/limits.ts) EXACTLY — it computes
// the Monday-of-week key in UTC and stores it as `tokenWeek`. Computing it in
// local time here made the keys disagree for non-UTC users near week boundaries,
// so `usage.tokenWeek === weekKey` failed and the weekly bar read 0% mid-week.
function getWeekKey() {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

export default function UsageSettings({ plan, usage, onUpgrade }: Props & { onUpgrade?: () => void }) {
  const isPaid = isPaidPlan(plan);
  const today   = new Date().toISOString().slice(0, 10);
  const weekKey = getWeekKey();

  // 🪤 The SAME function the server gates on (lib/plan.ts). Recomputing the
  // ceilings here is how the meter and the gate drift apart — an add-on holder
  // would see a bar pinned at 100% while the server served them fine.
  const { daily: dailyLimit, weekly: weeklyLimit } = planCeilings({ plan, limitAddonQty: usage.limitAddonQty });

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
        /* No active plan — MODUS is fully paid */
        <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-text">No active plan</h3>
          <p className="text-sm text-muted">MODUS requires an active plan. Start your 3-day free trial to unlock chat, briefings, and everything else.</p>
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
            { label: 'AI access',         value: 'Requires an active plan' },
            { label: 'Free trial',        value: '3 days, card required' },
            { label: 'MODUS',             value: '$24/mo' },
            { label: 'PILOT',             value: '$59/mo' },
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
