'use client';

import { isPaidPlan, planCeilings } from '@/lib/plan';
import { unlockedModels } from '@/lib/models';
import { costWeight } from '@/lib/chat/model-cost';
import { WINDOW_MS, WINDOW_HOURS } from '@/lib/constants';

/**
 * What each model this plan can pick actually costs against the allowance.
 *
 * 🔑 READ FROM costWeight() AT RUNTIME, never hand-maintained. This list exists
 * precisely because the allowance is denominated in cost units, so a hardcoded
 * copy that drifted from the real weights would recreate the bug it explains.
 *
 * Models sharing a weight collapse into one row — nobody needs three separate
 * lines all saying 2x.
 */
function allowanceCosts(plan: string) {
  const byWeight = new Map<number, string[]>();
  for (const m of unlockedModels(plan)) {
    const w = costWeight(m.id);
    byWeight.set(w, [...(byWeight.get(w) ?? []), m.name]);
  }
  return Array.from(byWeight.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weight, names]) => ({
      weight,
      // Three names still fit on one line at the narrowest supported width;
      // beyond that it wraps into a wall, so trim with a count.
      label: names.length <= 3 ? names.join(' / ') : `${names.slice(0, 2).join(' / ')} +${names.length - 2} more`,
    }));
}

interface Props {
  plan: 'free' | 'modus' | 'pilot' | 'group';
  usage: {
    dailyMessages: number; usageDate: string;
    windowTokens: number;  windowStart: number;
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
  const now     = Date.now();
  const weekKey = getWeekKey();

  // 🪤 The SAME function the server gates on (lib/plan.ts). Recomputing the
  // ceilings here is how the meter and the gate drift apart — an add-on holder
  // would see a bar pinned at 100% while the server served them fine.
  const { window: windowLimit, weekly: weeklyLimit } = planCeilings({ plan, limitAddonQty: usage.limitAddonQty });
  const costs = allowanceCosts(plan);

  // 🕔 The short window is rolling: an expired (or never-started) window reads as
  // 0, matching enforcePaidTokenLimit in lib/chat/limits.ts exactly.
  const windowLive   = usage.windowStart > 0 && now < usage.windowStart + WINDOW_MS;
  const windowCount  = windowLive ? usage.windowTokens : 0;
  const weeklyCount  = usage.tokenWeek === weekKey ? usage.weeklyTokens : 0;

  const windowPct  = Math.min(100, (windowCount / windowLimit) * 100);
  const weeklyPct  = Math.min(100, (weeklyCount / weeklyLimit) * 100);

  const resetTime = (() => {
    if (!windowLive) return null;
    const diff = usage.windowStart + WINDOW_MS - now;
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
          {/* Current rolling window */}
          <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-text">Current session</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-brand">{windowPct.toFixed(1)}%</p>
                <p className="text-xs text-muted">used this {WINDOW_HOURS}h window</p>
              </div>
              <UsageBar value={windowCount} max={windowLimit} />
              {/* 🚨 NO RAW COUNT HERE. The counters store COST UNITS, not tokens
                  (trackTokenUsage weights by costWeight before incrementing), so
                  "N of 1,500,000 tokens" was wrong by up to 27x on the frontier
                  models PILOT exists to sell. ChatWindow already settled on a
                  percentage for the same reason. The hard figure still appears,
                  correctly labelled, under Plan Limits below. */}
              <div className="flex justify-end text-xs text-muted">
                <span>{resetTime ? `Resets in ${resetTime}` : `A fresh ${WINDOW_HOURS}h window starts on your next message`}</span>
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
              <div className="flex justify-end text-xs text-muted">
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

      {/* What actually drains the allowance.
          This card is the honest replacement for the old "Daily AI tokens —
          1,500,000/day" row. The allowance is denominated in cost units, so the
          only figure that means anything to a user is the RELATIVE cost of the
          models they can pick — and that is exact, not an estimate. */}
      {isPaid && costs.length > 1 && (
        <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text mb-1">What uses your allowance</h3>
            <p className="text-xs text-muted leading-relaxed">
              Every model draws from the same allowance, but not at the same rate — the more
              capable ones cost more per message.
            </p>
          </div>
          <div className="space-y-0">
            {costs.map(c => (
              <div key={c.weight} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted">{c.label}</span>
                <span className="text-sm text-text font-medium tabular-nums">{c.weight}×</span>
              </div>
            ))}
          </div>
          {/* Derived from the weights actually present, so it can't go stale. */}
          <p className="text-xs text-muted leading-relaxed">
            One {costs[costs.length - 1].label.split(' / ')[0]} message uses about{' '}
            <span className="text-text font-medium">{costs[costs.length - 1].weight}×</span>{' '}
            the allowance of a {costs[0].label.split(' / ')[0]} one.
          </p>
        </div>
      )}

      {/* Plan limits */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Plan Limits</h3>
        <div className="space-y-3">
          {(isPaid ? [
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
        {/* The hard figure, kept but de-emphasised. Someone checking our
            arithmetic can still see it; it is just no longer the headline, and
            it says credits because that is what it counts. planCeilings()
            already folds in any purchased add-on. */}
        {isPaid && (
          <p className="text-xs text-muted/70 pt-1 leading-relaxed">
            Usage allowance: {windowLimit.toLocaleString()} credits per {WINDOW_HOURS}h ·{' '}
            {weeklyLimit.toLocaleString()}/week
            {(usage.limitAddonQty ?? 0) > 0 && ` · includes ${usage.limitAddonQty}× extra limits`}
          </p>
        )}
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
