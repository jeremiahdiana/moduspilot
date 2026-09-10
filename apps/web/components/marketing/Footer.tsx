'use client';

import { useState } from 'react';

const LINKS = {
  Product: [
    { label: 'Chat', href: '/features' },
    { label: 'Compare models', href: '/product/compare' },
    { label: 'Integrations', href: '/product/integrations' },
    { label: 'Desktop apps', href: '/download/mac' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Download', href: '/download/mac' },
    { label: 'Changelog', href: '/changelog' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Use cases', href: '/use-cases' },
    { label: 'Pricing', href: '/pricing' },
  ],
  'Get started': [
    { label: 'Start free', href: '/login' },
    { label: 'Sign in', href: '/login' },
    { label: 'Dashboard', href: '/dashboard' },
  ],
};

function Newsletter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 md:items-end pb-14 mb-14 border-b border-border">
      <div>
        <h2 className="text-2xl sm:text-3xl text-text tracking-tight mb-2">Stay in the loop</h2>
        <p className="text-sm text-muted leading-relaxed max-w-sm">
          The occasional update on new models, features and what we are shipping. No spam.
        </p>
      </div>
      {state === 'done' ? (
        <p className="text-sm text-text md:justify-self-end">Thanks. You are on the list.</p>
      ) : (
        <form onSubmit={submit} className="flex gap-2 md:justify-self-end w-full max-w-sm">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@work.com"
            className="flex-1 min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-text/40 transition-colors"
          />
          <button type="submit" className="btn-ink px-4 py-2.5 text-sm shrink-0" disabled={state === 'loading'}>
            {state === 'loading' ? '…' : 'Subscribe'}
          </button>
        </form>
      )}
      {state === 'error' && (
        <p className="text-xs text-red-500 md:col-start-2 md:justify-self-end">Something went wrong. Try again.</p>
      )}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-panel px-6 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <Newsletter />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-xl font-bold tracking-widest text-text">MODUS</span>
              <span className="text-[10px] font-semibold text-muted tracking-widest uppercase">pilot</span>
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-[220px]">
              Every model, and your whole life connected. One subscription.
            </p>
          </div>

          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-text uppercase tracking-widest mb-4">{group}</p>
              <ul className="space-y-2.5">
                {items.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted hover:text-text transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">© 2026 Modus. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs text-muted hover:text-text transition-colors">Privacy</a>
            <a href="/terms" className="text-xs text-muted hover:text-text transition-colors">Terms</a>
            <span className="text-xs text-muted">moduspilot.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
