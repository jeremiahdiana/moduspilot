'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from 'firebase/auth';

const COMING_SOON = [
  { id: 'notion', label: 'Notion', desc: 'Sync goals and tasks with your Notion workspace.' },
  { id: 'slack',  label: 'Slack',  desc: 'Get briefings and approvals via Slack messages.' },
  { id: 'github', label: 'GitHub', desc: 'Track repos, issues, and PRs in your context.' },
];

interface GoogleAccount {
  email: string;
  connectedAt: string | null;
}

interface Props { user: User }

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function avatarColor(email: string) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

export default function ConnectorsSettings({ user }: Props) {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    user.getIdToken().then(async token => {
      try {
        const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    });
  }, [user]);

  // Pick up ?connected= param after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected && connected !== 'google') {
      // Refetch accounts list
      user.getIdToken().then(async token => {
        const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAccounts(data.accounts ?? []);
        // Clear the param without reload
        window.history.replaceState({}, '', window.location.pathname + '?tab=connectors');
      });
    }
  }, [user]);

  async function connectGoogle() {
    setConnecting(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/google/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Failed to start Google auth. Try again.');
      setConnecting(false);
    }
  }

  async function disconnectAccount(email: string) {
    setDisconnecting(email);
    setError('');
    try {
      const token = await user.getIdToken();
      await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setAccounts(prev => prev.filter(a => a.email !== email));
    } catch {
      setError('Failed to disconnect. Try again.');
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Connectors</h2>
        <p className="text-sm text-muted">Integrate external accounts and services with MODUS.</p>
      </div>

      {/* Google accounts */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0">
              <GoogleIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Google</p>
              <p className="text-xs text-muted">Gmail · Calendar · Drive</p>
            </div>
          </div>

          {loading ? (
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          ) : accounts.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>

        {/* Connected account rows */}
        <AnimatePresence>
          {accounts.map((account, i) => (
            <motion.div
              key={account.email}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-border/50 last:border-b-0"
            >
              <div className="flex items-center gap-3 px-6 py-4">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${avatarColor(account.email)} flex items-center justify-center shrink-0`}>
                  <span className="text-xs font-bold text-white">{account.email[0].toUpperCase()}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{account.email}</p>
                  <p className="text-[11px] text-muted">
                    {account.connectedAt
                      ? `Connected ${new Date(account.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Connected'}
                    {' · '}Gmail · Calendar · Drive
                  </p>
                </div>

                {/* Disconnect */}
                <button
                  onClick={() => disconnectAccount(account.email)}
                  disabled={disconnecting === account.email}
                  className="text-xs text-muted hover:text-red-400 border border-border hover:border-red-400/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {disconnecting === account.email ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
                      Removing…
                    </span>
                  ) : 'Disconnect'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add account / connect first */}
        <div className="px-6 py-5">
          <p className="text-xs text-muted mb-4">
            {accounts.length > 0
              ? 'MODUS merges all connected inboxes into one unified view. Add as many Gmail accounts as you need.'
              : 'Connect Google to give MODUS access to your inbox, calendar, and Drive files.'}
          </p>

          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

          <button
            onClick={connectGoogle}
            disabled={connecting}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {connecting ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
            {connecting ? 'Redirecting…' : accounts.length > 0 ? 'Add another Gmail account' : 'Connect Google'}
          </button>
        </div>
      </div>

      {/* Coming soon */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">More Integrations</h3>
          <span className="text-xs text-muted bg-border/50 px-2 py-1 rounded">Coming Soon</span>
        </div>
        <div className="space-y-2">
          {COMING_SOON.map(item => (
            <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-bg border border-border opacity-50">
              <div>
                <p className="text-sm text-text font-medium">{item.label}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
              <span className="text-xs text-muted shrink-0">Soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom MCP */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text">Custom Connector</h3>
        <p className="text-xs text-muted">Connect any API, database, or service to MODUS via MCP (Model Context Protocol).</p>
        <button disabled className="px-4 py-2 border border-border text-muted text-sm rounded-lg opacity-50 cursor-not-allowed">
          Add Custom Connector
        </button>
        <p className="text-[11px] text-muted/50 italic">Coming soon — MCP server support.</p>
      </div>
    </div>
  );
}
