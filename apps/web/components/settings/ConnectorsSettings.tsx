'use client';

import { useState } from 'react';
import { GoogleAuthProvider, linkWithPopup, unlink } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';

const THIRD_PARTY = [
  { id: 'google-drive', label: 'Google Drive', desc: 'Access and attach files from Drive in chat.', icon: '◈' },
  { id: 'gmail', label: 'Gmail', desc: 'Let MODUS draft emails and summarize threads.', icon: '◎' },
  { id: 'notion', label: 'Notion', desc: 'Sync goals and tasks with your Notion workspace.', icon: '◉' },
  { id: 'slack', label: 'Slack', desc: 'Get briefings and approvals via Slack messages.', icon: '◆' },
  { id: 'github', label: 'GitHub', desc: 'Track repos, issues, and PRs in your context.', icon: '◇' },
];

interface Props {
  user: User;
}

export default function ConnectorsSettings({ user }: Props) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState(user.providerData.map(p => p.providerId));

  const hasGoogle = providers.includes('google.com');

  const linkGoogle = async () => {
    setLinking(true);
    setError('');
    try {
      const result = await linkWithPopup(auth.currentUser!, new GoogleAuthProvider());
      setProviders(result.user.providerData.map(p => p.providerId));
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('already-in-use')) {
        setError('This Google account is already linked to another MODUS account.');
      } else if (!(e instanceof Error && e.message.includes('popup-closed'))) {
        setError('Failed to link Google account.');
      }
    } finally {
      setLinking(false);
    }
  };

  const unlinkGoogle = async () => {
    setError('');
    try {
      await unlink(auth.currentUser!, 'google.com');
      setProviders(prev => prev.filter(p => p !== 'google.com'));
    } catch {
      setError('Failed to unlink Google. Make sure you have another login method first.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Connectors</h2>
        <p className="text-sm text-muted">Integrate external accounts and services with MODUS.</p>
      </div>

      {/* Auth providers */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text">Login Providers</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-bg border border-border">
            <div className="flex items-center gap-3">
              <span className="text-base">◎</span>
              <div>
                <p className="text-sm text-text">Google</p>
                <p className="text-xs text-muted">{user.email}</p>
              </div>
            </div>
            {hasGoogle ? (
              <button
                onClick={unlinkGoogle}
                disabled={providers.length === 1}
                title={providers.length === 1 ? "Can't unlink your only login method" : ''}
                className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={linkGoogle}
                disabled={linking}
                className="text-xs text-brand hover:underline transition-colors"
              >
                {linking ? 'Connecting…' : 'Connect'}
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Third-party integrations */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Integrations</h3>
          <span className="text-xs text-muted bg-border/50 px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-xs text-muted">Connect external services to give MODUS richer context and more actions it can take on your behalf.</p>
        <div className="space-y-2">
          {THIRD_PARTY.map(item => (
            <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-bg border border-border opacity-60">
              <div className="flex items-center gap-3">
                <span className="text-base text-muted">{item.icon}</span>
                <div>
                  <p className="text-sm text-text">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              </div>
              <span className="text-xs text-muted">Soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom MCP */}
      <div className="bg-panel border border-border rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text">Custom Connector</h3>
        <p className="text-xs text-muted">Add your own data sources or tools via MCP (Model Context Protocol). Connect any API, database, or service directly to MODUS.</p>
        <button
          disabled
          className="px-4 py-2 border border-border text-muted text-sm rounded-lg opacity-50 cursor-not-allowed"
        >
          Add Custom Connector
        </button>
        <p className="text-xs text-muted/50 italic">Coming soon — MCP server support.</p>
      </div>
    </div>
  );
}
