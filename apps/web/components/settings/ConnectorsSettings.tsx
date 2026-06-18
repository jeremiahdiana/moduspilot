'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from 'firebase/auth';

interface GoogleAccount { email: string; connectedAt: string | null; }
interface NotionAccount { workspaceId: string; workspaceName: string; workspaceIcon: string | null; ownerEmail: string; connectedAt: string | null; }
interface SlackAccount { teamId: string; teamName: string; connectedAt: string | null; }
interface GitHubAccount { login: string; name: string | null; avatarUrl: string; connectedAt: string | null; }
interface McpServerEntry { id: string; name: string; url: string; authHeader?: string; createdAt: string; }
interface DeviceItem { count?: number; permission: string | null; enabled: boolean; }
interface DeviceStatus { contacts: DeviceItem; health: DeviceItem; photos: DeviceItem; }
interface ContactEntry { id: string; name: string; email: string | null; phone: string | null; company: string | null; userCategory: string | null; }

interface Props { user: User }

// ── Icons ────────────────────────────────────────────────────────────────────

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

function NotionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function PhotosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

function avatarColor(seed: string) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Connected';
  return `Connected ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function ConnectedBadge({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {count} {count === 1 ? 'workspace' : 'workspaces'} connected
    </span>
  );
}

function NotConnectedBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
      Not connected
    </span>
  );
}

function DisconnectBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-xs text-muted hover:text-red-400 border border-border hover:border-red-400/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
          Removing…
        </span>
      ) : 'Disconnect'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectorsSettings({ user }: Props) {
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [notionAccounts, setNotionAccounts] = useState<NotionAccount[]>([]);
  const [slackAccounts, setSlackAccounts] = useState<SlackAccount[]>([]);
  const [githubAccounts, setGithubAccounts] = useState<GitHubAccount[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsList, setContactsList] = useState<ContactEntry[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsSaving, setContactsSaving] = useState<string | null>(null);

  // MCP form state
  const [mcpFormOpen, setMcpFormOpen] = useState(false);
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpAuth, setMcpAuth] = useState('');
  const [mcpTesting, setMcpTesting] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState<{ ok: boolean; tools?: string[]; error?: string } | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpRemoving, setMcpRemoving] = useState<string | null>(null);

  useEffect(() => {
    user.getIdToken().then(async token => {
      try {
        const [googleRes, connRes, mcpRes, deviceRes] = await Promise.all([
          fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/connectors/status', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/mcp/list', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/mobile/status', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [googleData, connData, mcpData, deviceData] = await Promise.all([googleRes.json(), connRes.json(), mcpRes.json(), deviceRes.json()]);
        setGoogleAccounts(googleData.accounts ?? []);
        setNotionAccounts(connData.notion ?? []);
        setSlackAccounts(connData.slack ?? []);
        setGithubAccounts(connData.github ?? []);
        setMcpServers(mcpData.servers ?? []);
        setDeviceStatus(deviceData);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    });
  }, [user]);

  // Handle ?connected= after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const err = params.get('error');
    if (err) {
      const labels: Record<string, string> = { notion_denied: 'Notion auth cancelled.', notion_failed: 'Notion connection failed.', slack_denied: 'Slack auth cancelled.', slack_failed: 'Slack connection failed.', github_denied: 'GitHub auth cancelled.', github_failed: 'GitHub connection failed.' };
      setError(labels[err] ?? 'Connection failed.');
      window.history.replaceState({}, '', window.location.pathname + '?tab=connectors');
    }
    if (connected && ['notion', 'slack', 'github'].includes(connected)) {
      user.getIdToken().then(async token => {
        const res = await fetch('/api/connectors/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setNotionAccounts(data.notion ?? []);
        setSlackAccounts(data.slack ?? []);
        setGithubAccounts(data.github ?? []);
        window.history.replaceState({}, '', window.location.pathname + '?tab=connectors');
      });
    }
    if (connected && connected.includes('@')) {
      // Google account connected — refresh the accounts list
      user.getIdToken().then(async token => {
        const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setGoogleAccounts(data.accounts ?? []);
        window.history.replaceState({}, '', window.location.pathname + '?tab=connectors');
      });
    }
  }, [user]);

  async function connectService(endpoint: string, key: string) {
    setConnecting(key);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError(`Failed to start ${key} auth. Try again.`);
      setConnecting(null);
    }
  }

  async function connectGoogle() {
    setConnecting('google');
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/google/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Failed to start Google auth. Try again.');
      setConnecting(null);
    }
  }

  async function disconnectGoogle(email: string) {
    setDisconnecting(email);
    setError('');
    try {
      const token = await user.getIdToken();
      await fetch('/api/google/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      setGoogleAccounts(prev => prev.filter(a => a.email !== email));
    } catch { setError('Failed to disconnect. Try again.'); }
    finally { setDisconnecting(null); }
  }

  async function disconnectNotion(workspaceId: string) {
    setDisconnecting(workspaceId);
    try {
      const token = await user.getIdToken();
      await fetch('/api/notion/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId }) });
      setNotionAccounts(prev => prev.filter(a => a.workspaceId !== workspaceId));
    } catch { setError('Failed to disconnect. Try again.'); }
    finally { setDisconnecting(null); }
  }

  async function disconnectSlack(teamId: string) {
    setDisconnecting(teamId);
    try {
      const token = await user.getIdToken();
      await fetch('/api/slack/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId }) });
      setSlackAccounts(prev => prev.filter(a => a.teamId !== teamId));
    } catch { setError('Failed to disconnect. Try again.'); }
    finally { setDisconnecting(null); }
  }

  async function testMcpConnection() {
    setMcpTesting(true);
    setMcpTestResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mcpUrl.trim(), authHeader: mcpAuth.trim() || undefined }),
      });
      const data = await res.json();
      setMcpTestResult(data);
    } catch {
      setMcpTestResult({ ok: false, error: 'Request failed' });
    } finally {
      setMcpTesting(false);
    }
  }

  async function loadContacts() {
    setContactsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/contacts', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setContactsList(data.contacts ?? []);
    } catch { /* non-fatal */ }
    finally { setContactsLoading(false); }
  }

  async function setContactCategory(id: string, category: string | null) {
    setContactsSaving(id);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCategory: category }),
      });
      setContactsList(prev => prev.map(c => c.id === id ? { ...c, userCategory: category } : c));
    } catch { /* non-fatal */ }
    finally { setContactsSaving(null); }
  }

  function toggleContactsPanel() {
    if (!contactsOpen && contactsList.length === 0) loadContacts();
    setContactsOpen(o => !o);
  }

  async function saveMcpServer() {
    if (!mcpName.trim() || !mcpUrl.trim()) return;
    setMcpSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mcp/add', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mcpName.trim(), url: mcpUrl.trim(), authHeader: mcpAuth.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save server'); return; }
      setMcpServers(prev => [...prev, { id: data.id, name: mcpName.trim(), url: mcpUrl.trim(), authHeader: mcpAuth.trim() || undefined, createdAt: new Date().toISOString() }]);
      setMcpFormOpen(false);
      setMcpName(''); setMcpUrl(''); setMcpAuth(''); setMcpTestResult(null);
    } catch {
      setError('Failed to save server');
    } finally {
      setMcpSaving(false);
    }
  }

  async function removeMcpServer(serverId: string) {
    setMcpRemoving(serverId);
    try {
      const token = await user.getIdToken();
      await fetch('/api/mcp/remove', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      });
      setMcpServers(prev => prev.filter(s => s.id !== serverId));
    } catch { setError('Failed to remove server'); }
    finally { setMcpRemoving(null); }
  }

  async function disconnectGitHub(login: string) {
    setDisconnecting(login);
    try {
      const token = await user.getIdToken();
      await fetch('/api/github/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ login }) });
      setGithubAccounts(prev => prev.filter(a => a.login !== login));
    } catch { setError('Failed to disconnect. Try again.'); }
    finally { setDisconnecting(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Connectors</h2>
        <p className="text-sm text-muted">Integrate external accounts and services with MODUS.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* ── Google ── */}
      <ConnectorCard
        icon={<GoogleIcon />}
        label="Google"
        subtitle="Gmail · Calendar · Drive"
        loading={loading}
        connectedCount={googleAccounts.length}
        connectedLabel={`${googleAccounts.length} account${googleAccounts.length !== 1 ? 's' : ''} connected`}
      >
        <AnimatePresence>
          {googleAccounts.map(account => (
            <AccountRow
              key={account.email}
              avatar={<InitialAvatar seed={account.email} />}
              title={account.email}
              subtitle={`${fmtDate(account.connectedAt)} · Gmail · Calendar · Drive`}
              onDisconnect={() => disconnectGoogle(account.email)}
              disconnecting={disconnecting === account.email}
            />
          ))}
        </AnimatePresence>
        <div className="px-6 py-5">
          <p className="text-xs text-muted mb-4">
            {googleAccounts.length > 0
              ? 'MODUS merges all connected inboxes into one unified view.'
              : 'Connect Google to give MODUS access to your inbox, calendar, and Drive.'}
          </p>
          <ConnectButton
            loading={connecting === 'google'}
            hasAccounts={googleAccounts.length > 0}
            addLabel="Add another Gmail account"
            connectLabel="Connect Google"
            onClick={connectGoogle}
          />
        </div>
      </ConnectorCard>

      {/* ── Notion ── */}
      <ConnectorCard
        icon={<NotionIcon />}
        label="Notion"
        subtitle="Pages · Databases · Notes"
        loading={loading}
        connectedCount={notionAccounts.length}
        connectedLabel={`${notionAccounts.length} workspace${notionAccounts.length !== 1 ? 's' : ''} connected`}
      >
        <AnimatePresence>
          {notionAccounts.map(account => (
            <AccountRow
              key={account.workspaceId}
              avatar={
                account.workspaceIcon
                  ? <img src={account.workspaceIcon} alt="" className="w-8 h-8 rounded-full object-cover" />
                  : <InitialAvatar seed={account.workspaceName} />
              }
              title={account.workspaceName}
              subtitle={`${fmtDate(account.connectedAt)}${account.ownerEmail ? ` · ${account.ownerEmail}` : ''}`}
              onDisconnect={() => disconnectNotion(account.workspaceId)}
              disconnecting={disconnecting === account.workspaceId}
            />
          ))}
        </AnimatePresence>
        <div className="px-6 py-5">
          <p className="text-xs text-muted mb-4">
            {notionAccounts.length > 0
              ? 'MODUS can read your Notion pages and databases for context in chat.'
              : 'Connect Notion to give MODUS access to your pages and databases.'}
          </p>
          <ConnectButton
            loading={connecting === 'notion'}
            hasAccounts={notionAccounts.length > 0}
            addLabel="Add another workspace"
            connectLabel="Connect Notion"
            onClick={() => connectService('/api/auth/notion/connect', 'notion')}
          />
        </div>
      </ConnectorCard>

      {/* ── Slack ── */}
      <ConnectorCard
        icon={<SlackIcon />}
        label="Slack"
        subtitle="Channels · Messages · DMs"
        loading={loading}
        connectedCount={slackAccounts.length}
        connectedLabel={`${slackAccounts.length} workspace${slackAccounts.length !== 1 ? 's' : ''} connected`}
      >
        <AnimatePresence>
          {slackAccounts.map(account => (
            <AccountRow
              key={account.teamId}
              avatar={<InitialAvatar seed={account.teamName} />}
              title={account.teamName}
              subtitle={fmtDate(account.connectedAt)}
              onDisconnect={() => disconnectSlack(account.teamId)}
              disconnecting={disconnecting === account.teamId}
            />
          ))}
        </AnimatePresence>
        <div className="px-6 py-5">
          <p className="text-xs text-muted mb-4">
            {slackAccounts.length > 0
              ? 'MODUS can read Slack channels and send messages on your behalf.'
              : 'Connect Slack to get briefings and use MODUS from your workspace.'}
          </p>
          {slackAccounts.length > 0 && (
            <p className="text-xs text-muted/70 mb-4 border border-border rounded-lg px-3 py-2">
              MODUS can only read channels it has been invited to. Run <span className="font-mono text-text/80">/invite @MODUS</span> in any channel you want it to see.
            </p>
          )}
          <ConnectButton
            loading={connecting === 'slack'}
            hasAccounts={slackAccounts.length > 0}
            addLabel="Add another workspace"
            connectLabel="Connect Slack"
            onClick={() => connectService('/api/auth/slack/connect', 'slack')}
          />
        </div>
      </ConnectorCard>

      {/* ── GitHub ── */}
      <ConnectorCard
        icon={<GitHubIcon />}
        label="GitHub"
        subtitle="Repos · Issues · Pull Requests"
        loading={loading}
        connectedCount={githubAccounts.length}
        connectedLabel={`${githubAccounts.length} account${githubAccounts.length !== 1 ? 's' : ''} connected`}
      >
        <AnimatePresence>
          {githubAccounts.map(account => (
            <AccountRow
              key={account.login}
              avatar={
                account.avatarUrl
                  ? <img src={account.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  : <InitialAvatar seed={account.login} />
              }
              title={account.name ?? account.login}
              subtitle={`${fmtDate(account.connectedAt)} · @${account.login}`}
              onDisconnect={() => disconnectGitHub(account.login)}
              disconnecting={disconnecting === account.login}
            />
          ))}
        </AnimatePresence>
        <div className="px-6 py-5">
          <p className="text-xs text-muted mb-4">
            {githubAccounts.length > 0
              ? 'MODUS can track your repos, open issues, and pull requests.'
              : 'Connect GitHub to give MODUS context on your repos and issues.'}
          </p>
          <ConnectButton
            loading={connecting === 'github'}
            hasAccounts={githubAccounts.length > 0}
            addLabel="Add another account"
            connectLabel="Connect GitHub"
            onClick={() => connectService('/api/auth/github/connect', 'github')}
          />
        </div>
      </ConnectorCard>

      {/* ── On This Device ── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">On This Device</h3>
        <div className="bg-panel border border-border rounded-xl overflow-hidden divide-y divide-border">
          {/* Contacts row — expandable manage panel */}
          <div>
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 text-text">
                <ContactsIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">Contacts</p>
                <p className="text-xs text-muted">
                  {deviceStatus?.contacts.count ? `${deviceStatus.contacts.count} contacts synced · relationship tracking` : 'Relationship tracking & follow-up nudges'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {loading ? (
                  <div className="w-20 h-5 rounded-full bg-border animate-pulse" />
                ) : (
                  <>
                    <PermBadge permission={deviceStatus?.contacts.permission ?? null} />
                    {(deviceStatus?.contacts.count ?? 0) > 0 && (
                      <button
                        onClick={toggleContactsPanel}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        {contactsOpen ? 'Close' : 'Manage'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {contactsOpen && (
              <div className="border-t border-border px-6 py-4 space-y-3">
                <input
                  type="text"
                  placeholder="Search contacts…"
                  value={contactsSearch}
                  onChange={e => setContactsSearch(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-brand"
                />
                {contactsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {contactsList
                      .filter(c => {
                        const q = contactsSearch.toLowerCase();
                        return !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
                      })
                      .map(c => {
                        const sub = [c.company, c.email ?? c.phone].filter(Boolean).join(' · ');
                        const saving = contactsSaving === c.id;
                        return (
                          <div key={c.id} className={`flex items-start gap-3 py-2 ${c.userCategory === 'excluded' ? 'opacity-40' : ''}`}>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className={`text-sm font-medium text-text truncate ${c.userCategory === 'excluded' ? 'line-through' : ''}`}>{c.name}</p>
                              {sub && <p className="text-xs text-muted truncate">{sub}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {saving && <div className="w-3 h-3 border border-brand border-t-transparent rounded-full animate-spin mr-1" />}
                              {(['personal', 'professional', 'service', 'excluded'] as const).map(cat => (
                                <button
                                  key={cat}
                                  disabled={saving}
                                  onClick={() => setContactCategory(c.id, c.userCategory === cat ? null : cat)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors capitalize ${
                                    c.userCategory === cat
                                      ? cat === 'excluded'
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : 'bg-brand/20 text-brand border border-brand/30'
                                      : 'bg-bg border border-border text-muted hover:text-text'
                                  }`}
                                >
                                  {cat === 'excluded' ? 'Exclude' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    {contactsList.filter(c => {
                      const q = contactsSearch.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-xs text-muted text-center py-4">No contacts match</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted pt-1">Re-open the iOS app to refresh company and job data. Click a category to override — click again to revert to auto-detection.</p>
              </div>
            )}
          </div>
          <DeviceRow
            icon={<HealthIcon />}
            label="Health"
            desc="Steps & sleep data in your morning briefing"
            item={deviceStatus?.health ?? null}
            loading={loading}
          />
          <DeviceRow
            icon={<PhotosIcon />}
            label="Photos"
            desc="Attach & reference photos in chat"
            item={deviceStatus?.photos ?? null}
            loading={loading}
          />
        </div>
        <p className="text-xs text-muted mt-3 px-1">
          Permission is managed in iOS Settings. Disable to stop MODUS from using that data even if permission is granted.
        </p>
      </div>

      {/* Custom MCP */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 text-text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
                <path d="M7 8l3 3-3 3M13 14h4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Custom MCP Server</p>
              <p className="text-xs text-muted">Model Context Protocol — connect any tool or data source</p>
            </div>
          </div>
          {loading ? (
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          ) : mcpServers.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {mcpServers.length} server{mcpServers.length !== 1 ? 's' : ''} connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>

        {/* Existing servers */}
        <AnimatePresence>
          {mcpServers.map(server => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-border/50"
            >
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-brand">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{server.name}</p>
                  <p className="text-[11px] text-muted truncate">{server.url}</p>
                </div>
                <DisconnectBtn
                  loading={mcpRemoving === server.id}
                  onClick={() => removeMcpServer(server.id)}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted">
            {mcpServers.length > 0
              ? 'MODUS will use tools from all connected MCP servers during chat.'
              : 'Connect an MCP server to give MODUS access to custom tools and data sources.'}
          </p>

          {!mcpFormOpen ? (
            <button
              onClick={() => setMcpFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add MCP Server
            </button>
          ) : (
            <div className="space-y-3 bg-bg border border-border rounded-xl p-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted">Server name</label>
                <input
                  value={mcpName}
                  onChange={e => setMcpName(e.target.value)}
                  placeholder="e.g. My Database"
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted">SSE endpoint URL</label>
                <input
                  value={mcpUrl}
                  onChange={e => { setMcpUrl(e.target.value); setMcpTestResult(null); }}
                  placeholder="https://your-mcp-server.com/sse"
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted">Authorization header <span className="text-muted/60">(optional)</span></label>
                <input
                  value={mcpAuth}
                  onChange={e => setMcpAuth(e.target.value)}
                  placeholder="Bearer your-token"
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-brand/50 transition-colors font-mono text-xs"
                />
              </div>

              {mcpTestResult && (
                <div className={`flex items-start gap-1.5 rounded-lg px-3 py-2.5 text-xs ${mcpTestResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                  {mcpTestResult.ok ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {`Connected — ${mcpTestResult.tools?.length ?? 0} tool${(mcpTestResult.tools?.length ?? 0) !== 1 ? 's' : ''} found${mcpTestResult.tools?.length ? ': ' + mcpTestResult.tools.slice(0, 4).join(', ') + (mcpTestResult.tools.length > 4 ? ` +${mcpTestResult.tools.length - 4} more` : '') : ''}`}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0 mt-0.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {mcpTestResult.error}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={testMcpConnection}
                  disabled={mcpTesting || !mcpUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border text-sm text-muted hover:text-text hover:border-brand/40 rounded-lg transition-colors disabled:opacity-40"
                >
                  {mcpTesting ? <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" /> : null}
                  {mcpTesting ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  onClick={saveMcpServer}
                  disabled={mcpSaving || !mcpName.trim() || !mcpUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-40 transition-colors"
                >
                  {mcpSaving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {mcpSaving ? 'Saving…' : 'Save server'}
                </button>
                <button
                  onClick={() => { setMcpFormOpen(false); setMcpName(''); setMcpUrl(''); setMcpAuth(''); setMcpTestResult(null); }}
                  className="px-3 py-2 border border-border text-sm text-muted hover:text-text rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectorCard({ icon, label, subtitle, loading, connectedCount, connectedLabel, children }: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  loading: boolean;
  connectedCount: number;
  connectedLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 text-text">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{label}</p>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        {loading ? (
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        ) : connectedCount > 0 ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {connectedLabel}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
            Not connected
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function AccountRow({ avatar, title, subtitle, onDisconnect, disconnecting }: {
  avatar: React.ReactNode;
  title: string;
  subtitle: string;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b border-border/50"
    >
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="shrink-0">{avatar}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{title}</p>
          <p className="text-[11px] text-muted">{subtitle}</p>
        </div>
        <DisconnectBtn loading={disconnecting} onClick={onDisconnect} />
      </div>
    </motion.div>
  );
}

function InitialAvatar({ seed }: { seed: string }) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  const color = colors[h % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
      <span className="text-xs font-bold text-white">{seed[0]?.toUpperCase() ?? '?'}</span>
    </div>
  );
}

function PermBadge({ permission }: { permission: string | null }) {
  if (!permission) return <span className="text-xs text-muted">Open iOS app to sync</span>;
  if (permission === 'granted') return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Enabled on iOS
    </span>
  );
  if (permission === 'denied') return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Denied on iOS
    </span>
  );
  if (permission === 'unavailable') return <span className="text-xs text-muted">Not available</span>;
  return <span className="text-xs text-muted">Not granted on iOS</span>;
}

function DeviceRow({ icon, label, desc, item, loading }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  item: { permission: string | null } | null;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 text-text">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <div className="shrink-0">
        {loading ? (
          <div className="w-20 h-5 rounded-full bg-border animate-pulse" />
        ) : (
          <PermBadge permission={item?.permission ?? null} />
        )}
      </div>
    </div>
  );
}

function ConnectButton({ loading, hasAccounts, addLabel, connectLabel, onClick }: {
  loading: boolean;
  hasAccounts: boolean;
  addLabel: string;
  connectLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      )}
      {loading ? 'Redirecting…' : hasAccounts ? addLabel : connectLabel}
    </button>
  );
}
