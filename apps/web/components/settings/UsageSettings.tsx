'use client';

const FREE_DAILY_LIMIT = 20;

interface Props {
  plan: 'free' | 'modus' | 'pilot';
  usage: { dailyMessages: number; usageDate: string };
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

export default function UsageSettings({ plan, usage }: Props) {
  const isPaid = plan === 'modus' || plan === 'pilot';
  const today = new Date().toISOString().slice(0, 10);
  const isToday = usage.usageDate === today;
  const dailyCount = isToday ? usage.dailyMessages : 0;

  const resetTime = (() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Usage</h2>
        <p className="text-sm text-muted">Track your message usage and plan limits.</p>
      </div>

      {/* Daily messages */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-text">Daily Messages</h3>

        {isPaid ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-brand">{dailyCount}</p>
              <p className="text-xs text-muted">Unlimited on {plan.toUpperCase()}</p>
            </div>
            <p className="text-xs text-muted">Messages sent today. No cap on your current plan.</p>
          </div>
        ) : (
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
        )}
      </div>

      {/* Plan summary */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Plan Limits</h3>
        <div className="space-y-3">
          {[
            { label: 'Daily messages', value: isPaid ? 'Unlimited' : `${FREE_DAILY_LIMIT}/day (after trial)` },
            { label: 'Conversations', value: isPaid ? 'Unlimited' : 'Unlimited' },
            { label: 'Goals / Tasks / Habits', value: 'Unlimited' },
            { label: 'Memory storage', value: isPaid ? 'Unlimited' : '50 memories' },
            { label: 'Data retention', value: isPaid ? '2 years' : '90 days' },
          ].map(row => (
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
            onClick={() => alert('Stripe checkout coming soon.')}
            className="shrink-0 px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
