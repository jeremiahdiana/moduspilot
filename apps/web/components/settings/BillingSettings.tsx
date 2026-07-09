'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';

const PLANS: Array<{
  key: 'free' | 'modus' | 'pilot' | 'group';
  label: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}> = [
  {
    key: 'modus',
    label: 'MODUS',
    price: '$24',
    period: '/mo',
    features: [
      'Unlimited messages',
      'Full chat history',
      'Priority AI responses',
      'Daily briefings',
      'Vector memory',
    ],
    popular: true,
  },
  {
    key: 'pilot',
    label: 'PILOT',
    price: '$59',
    period: '/mo',
    features: [
      'Everything in MODUS',
      'Wearables integration',
      'CRM sync',
      'Financial intelligence',
      'Dedicated onboarding',
    ],
  },
  {
    key: 'group',
    label: 'GROUP',
    price: '$79',
    period: '/mo',
    features: [
      '5 seats — each a full MODUS',
      'Everything in MODUS, per person',
      'Shared group space',
      'Cross-agent availability + scheduling',
      'Web + iOS + Mac for everyone',
    ],
  },
];

// Price order — decides whether a target plan is an upgrade or a downgrade.
const RANK: Record<'free' | 'modus' | 'pilot' | 'group', number> = { free: 0, modus: 1, pilot: 2, group: 3 };

interface Props {
  plan: 'free' | 'modus' | 'pilot' | 'group';
}

async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export default function BillingSettings({ plan }: Props) {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get('upgraded') === '1';
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Plan awaiting confirmation (existing subscribers only — new customers get
  // Stripe's own hosted confirm/pay page, so no extra step needed there).
  const [confirmPlan, setConfirmPlan] = useState<'modus' | 'pilot' | 'group' | null>(null);

  const handleChangePlan = async (targetPlan: 'modus' | 'pilot' | 'group') => {
    setLoading(targetPlan);
    setError('');
    try {
      const token = await getToken();
      if (!token) { setError('Please sign in first.'); return; }

      // New customers go through Checkout (starts the 3-day trial). Existing
      // subscribers reprice their current subscription in place — no second
      // trial, no duplicate subscription, prorated immediately.
      const isNewCustomer = plan === 'free';
      const endpoint = isNewCustomer ? '/api/stripe/checkout' : '/api/stripe/change-plan';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: targetPlan }),
      });

      const data = await res.json();
      if (!res.ok) { setConfirmPlan(null); setError(data.error ?? 'Something went wrong.'); return; }

      if (isNewCustomer) {
        window.location.href = data.url; // redirect to Stripe Checkout
      } else {
        // Repriced in place — reload so the new plan + success banner show.
        window.location.href = '/settings?tab=billing&upgraded=1';
      }
    } catch {
      setConfirmPlan(null);
      setError('Failed to change plan. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading('portal');
    setError('');
    try {
      const token = await getToken();
      if (!token) { setError('Please sign in.'); return; }

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      window.location.href = data.url;
    } catch {
      setError('Failed to open portal. Try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Billing</h2>
        <p className="text-sm text-muted">Manage your subscription and payment details.</p>
      </div>

      {/* Success banner */}
      {upgraded && (
        <div className="bg-brand/10 border border-brand/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-brand text-lg">◆</span>
          <div>
            <p className="text-sm font-semibold text-text">You're on {plan.toUpperCase()} — welcome.</p>
            <p className="text-xs text-muted">Your plan is active. All features are unlocked.</p>
          </div>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-panel border border-border rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Current Plan</p>
          <p className="text-2xl font-black tracking-wide text-brand">{plan.toUpperCase()}</p>
          {plan === 'free' && <p className="text-xs text-muted mt-1">No active subscription — start a 3-day trial below.</p>}
          {plan === 'modus' && <p className="text-xs text-muted mt-1">$24/mo — billed monthly.</p>}
          {plan === 'pilot' && <p className="text-xs text-muted mt-1">$59/mo — billed monthly.</p>}
          {plan === 'group' && <p className="text-xs text-muted mt-1">$79/mo — up to 5 members.</p>}
        </div>
        {plan !== 'free' && (
          <button
            onClick={handleManage}
            disabled={loading === 'portal'}
            className="px-4 py-2 border border-border text-muted text-sm rounded-lg hover:text-text hover:border-brand/40 transition-colors disabled:opacity-50"
          >
            {loading === 'portal' ? 'Opening…' : 'Manage'}
          </button>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(p => {
          const isCurrent = p.key === plan;
          const isUpgrade = RANK[p.key] > RANK[plan];
          return (
            <div
              key={p.key}
              className={`relative bg-panel border rounded-xl p-5 flex flex-col gap-4 ${
                isCurrent ? 'border-brand' : p.popular ? 'border-brand/30' : 'border-border'
              }`}
            >
              {p.popular && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-brand text-white font-semibold px-2.5 py-0.5 rounded-full">Most Popular</span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-brand text-white font-semibold px-2.5 py-0.5 rounded-full">Current</span>
              )}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{p.label}</p>
                <p className="text-2xl font-bold text-text">{p.price}<span className="text-sm font-normal text-muted">{p.period}</span></p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted">
                    <span className="text-brand mt-0.5">◆</span>
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <button
                  onClick={() => plan === 'free'
                    ? handleChangePlan(p.key as 'modus' | 'pilot' | 'group')
                    : setConfirmPlan(p.key as 'modus' | 'pilot' | 'group')}
                  disabled={!!loading}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    isUpgrade
                      ? 'bg-brand text-white hover:bg-brand/90'
                      : 'border border-border text-muted hover:text-text'
                  }`}
                >
                  {loading === p.key ? 'Working…' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment + invoices — managed via Stripe portal */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text">Payment Method & Invoices</h3>
        <p className="text-xs text-muted">Manage cards, view invoices, and download receipts in the Stripe billing portal.</p>
        {plan !== 'free' && (
          <button
            onClick={handleManage}
            disabled={!!loading}
            className="text-xs text-brand hover:underline disabled:opacity-50"
          >
            Open billing portal →
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Confirm a plan change before we charge / reprice the subscription. */}
      {confirmPlan && (() => {
        const target = PLANS.find(p => p.key === confirmPlan)!;
        const isUp = RANK[confirmPlan] > RANK[plan];
        const busy = loading === confirmPlan;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-border rounded-2xl max-w-md w-full p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text">
                  {isUp ? 'Upgrade' : 'Downgrade'} to {target.label}?
                </h3>
                <p className="text-sm text-muted mt-2">
                  {isUp ? (
                    <>Your plan switches to <span className="text-text font-medium">{target.label}</span> right now. Upgrades are prorated — you&apos;ll be charged the difference for the rest of this billing period (nothing extra while you&apos;re still in a free trial), then <span className="text-text font-medium">{target.price}/mo</span>.</>
                  ) : (
                    <>Your plan switches to <span className="text-text font-medium">{target.label}</span> right now at <span className="text-text font-medium">{target.price}/mo</span>. Any unused credit is applied to your next invoice.</>
                  )}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmPlan(null)}
                  disabled={busy}
                  className="px-4 py-2 text-sm text-muted hover:text-text transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleChangePlan(confirmPlan)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  {busy ? 'Working…' : isUp ? `Confirm upgrade` : `Confirm downgrade`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
